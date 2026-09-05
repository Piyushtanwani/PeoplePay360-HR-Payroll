import * as React from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { num } from '@/lib/format'
import type { TableController } from '@/lib/hooks/useTableState'
import { Button, EmptyState, Spinner, TableSkeleton, Tooltip } from './primitives'
import { Select } from './Select'

export type SortKey = string | number

export interface Column<T> {
  key: string
  header: React.ReactNode
  render: (row: T) => React.ReactNode
  /** Server-side sort. The column sends `sortKey ?? key` and the server decides the order. */
  sortable?: boolean
  sortKey?: string
  /** Client-side sort, for a table whose rows all arrived at once. */
  sortValue?: (row: T) => SortKey | SortKey[]
  align?: 'left' | 'right'
  width?: string
  /** A "?" on the column heading, for a figure whose derivation is not obvious. */
  tooltip?: React.ReactNode
  /** Drop the column entirely, for one the caller may not see. */
  hidden?: boolean
}

export interface EmptyCopy {
  title: string
  /** Required: an empty table must say what would be here and what to do about it. */
  description: string
  action?: React.ReactNode
  icon?: React.ReactNode
}

export interface DataTableProps<T extends { id: number | string }> {
  rows: T[]
  columns: Column<T>[]
  /** Required: every list explains its own emptiness. */
  empty: EmptyCopy

  /** Server mode: the controller drives paging, sorting and search, and `total` comes from the server. */
  table?: TableController
  total?: number
  /** Client mode: these fields are searched locally. Ignored when a controller is given. */
  searchKeys?: ((row: T) => string)[]

  loading?: boolean
  /** A refresh in flight. Rows stay put and dim, rather than collapsing to a skeleton. */
  fetching?: boolean
  error?: unknown
  onRetry?: () => void

  toolbar?: {
    search?: boolean | string
    filters?: React.ReactNode
    actions?: React.ReactNode
  }
  /** `embedded` drops the toolbar and footer but keeps identical header and cell styling. */
  chrome?: 'full' | 'embedded'

  onRowClick?: (row: T) => void
  rowDisabled?: (row: T) => boolean
  selectable?: boolean
  selectedIds?: Set<T['id']>
  onSelectionChange?: (ids: Set<T['id']>) => void

  /** Inserts a heading row whenever this value changes, for grouped lines. */
  groupBy?: (row: T) => string
  /** A footer row of totals, keyed by column. */
  summaryRow?: Partial<Record<string, React.ReactNode>>
  dense?: boolean
  caption?: string
}

const PAGE_SIZE_OPTIONS = [20, 50, 100]

/**
 * The one table in the application.
 *
 * Before this, every list rolled its own toolbar and asked the server for a hardcoded number of rows
 * between twenty and two hundred, with nothing on screen to say a list had been cut short. The table
 * now owns search, sort, paging and the empty state, so every list behaves and reads identically and a
 * page always says which rows of how many it is showing.
 */
export function DataTable<T extends { id: number | string }>({
  rows, columns, empty, table, total, searchKeys, loading, fetching, error, onRetry,
  toolbar, chrome = 'full', onRowClick, rowDisabled, selectable, selectedIds, onSelectionChange,
  groupBy, summaryRow, dense, caption,
}: DataTableProps<T>) {
  /**
   * Three ways to drive the same table, so every list looks and behaves alike.
   *
   * A controller with a `total` means the server did the filtering, sorting and paging. A controller
   * without one means the caller holds every row already, and the controller drives the same work
   * locally: a short list such as departments then gets the identical toolbar and footer without the
   * endpoint having to page. No controller at all is the embedded case, which only searches and sorts.
   */
  const controlled = Boolean(table)
  const serverMode = controlled && total !== undefined
  const localMode = controlled && !serverMode
  const visibleColumns = React.useMemo(() => columns.filter((c) => !c.hidden), [columns])

  // Without a controller the table keeps its own sort and search.
  const [clientSort, setClientSort] = React.useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)
  const [clientQuery, setClientQuery] = React.useState('')

  const activeSortKey = controlled ? table!.state.sort : clientSort?.key ?? null
  const activeSortDir = controlled ? table!.state.dir : clientSort?.dir ?? 'asc'
  const query = controlled ? table!.state.q : clientQuery

  const processed = React.useMemo(() => {
    if (serverMode) return rows
    let out = rows
    if (query && searchKeys?.length) {
      const needle = query.toLowerCase()
      out = out.filter((row) => searchKeys.some((read) => (read(row) ?? '').toLowerCase().includes(needle)))
    }
    if (activeSortKey) {
      const column = visibleColumns.find((c) => (c.sortKey ?? c.key) === activeSortKey)
      if (column?.sortValue) {
        out = [...out].sort((a, b) => {
          const result = compare(column.sortValue!(a), column.sortValue!(b))
          return activeSortDir === 'asc' ? result : -result
        })
      }
    }
    return out
  }, [serverMode, rows, query, searchKeys, activeSortKey, activeSortDir, visibleColumns])

  const totalRows = serverMode ? (total ?? rows.length) : processed.length
  const page = controlled ? table!.state.page : 0
  const size = controlled ? table!.state.size : processed.length || 1
  // The server already sliced its page; a local list slices here, so the footer means the same thing.
  const shown = localMode ? processed.slice(page * size, page * size + size) : processed

  const toggleSort = (column: Column<T>) => {
    if (controlled) {
      if (!isSortable(column)) return
      table!.setSort(column.sortKey ?? column.key)
      return
    }
    if (!column.sortValue) return
    setClientSort((prev) =>
      prev?.key === column.key ? { key: column.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key: column.key, dir: 'asc' },
    )
  }

  // The server sorts by column name; everything else needs a value to sort by.
  const isSortable = (column: Column<T>) =>
    serverMode ? Boolean(column.sortable) : Boolean(column.sortValue)

  // Select-all covers only rows that can actually be selected, so the header checkbox reads back
  // correctly when some rows are disabled. It used to compare against every row and never light up.
  const selectableRows = React.useMemo(() => shown.filter((r) => !rowDisabled?.(r)), [shown, rowDisabled])
  const selectedCount = selectableRows.filter((r) => selectedIds?.has(r.id)).length
  const allSelected = selectableRows.length > 0 && selectedCount === selectableRows.length
  const someSelected = selectedCount > 0 && !allSelected

  const showToolbar = chrome === 'full' && Boolean(toolbar)
  const showFooter = chrome === 'full' && totalRows > 0

  const body = () => {
    if (error) {
      return (
        <EmptyState
          title="This list could not be loaded"
          description={errorMessageOf(error)}
          action={onRetry ? <Button onClick={onRetry}>Try again</Button> : undefined}
        />
      )
    }
    if (loading) return <TableSkeleton cols={Math.min(visibleColumns.length, 6)} />
    if (!shown.length) {
      const narrowed = Boolean(query) || Boolean(toolbar?.filters)
      return (
        <EmptyState
          icon={empty.icon}
          title={query ? 'Nothing matches that search' : empty.title}
          description={query ? `No record matches “${query}”. Clear the search to see everything.` : empty.description}
          action={query ? undefined : narrowed ? empty.action : empty.action}
        />
      )
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-body">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-separator text-left">
              {selectable ? (
                <th className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all rows on this page"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected }}
                    onChange={(e) =>
                      onSelectionChange?.(new Set(e.target.checked ? selectableRows.map((r) => r.id) : []))
                    }
                  />
                </th>
              ) : null}
              {visibleColumns.map((column) => {
                const sorted = activeSortKey === (column.sortKey ?? column.key)
                return (
                  <th
                    key={column.key}
                    scope="col"
                    style={{ width: column.width }}
                    aria-sort={sorted ? (activeSortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn(
                      'px-4 py-2.5 text-xs2 font-semibold uppercase tracking-wide text-label2',
                      column.align === 'right' && 'text-right',
                    )}
                  >
                    <span className={cn('inline-flex items-center gap-1', column.align === 'right' && 'justify-end')}>
                      {isSortable(column) ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-label"
                          onClick={() => toggleSort(column)}
                        >
                          {column.header}
                          {sorted ? (
                            activeSortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                          ) : null}
                        </button>
                      ) : (
                        column.header
                      )}
                      {column.tooltip ? (
                        <Tooltip content={column.tooltip}>
                          <span className="cursor-help text-label2">ⓘ</span>
                        </Tooltip>
                      ) : null}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className={cn(fetching && 'opacity-60 transition-opacity')}>
            {shown.map((row, index) => {
              const disabled = rowDisabled?.(row)
              const groupLabel = groupBy?.(row)
              const newGroup = groupLabel !== undefined && (index === 0 || groupBy?.(shown[index - 1]) !== groupLabel)
              return (
                <React.Fragment key={String(row.id)}>
                  {newGroup ? (
                    <tr className="bg-surface2/60">
                      <td
                        colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                        className="px-4 py-1.5 text-xs2 font-semibold uppercase tracking-wide text-label2"
                      >
                        {groupLabel}
                      </td>
                    </tr>
                  ) : null}
                  <tr
                    onClick={() => !disabled && onRowClick?.(row)}
                    className={cn(
                      'border-b border-separator/60 last:border-0',
                      onRowClick && !disabled && 'cursor-pointer hover:bg-surface2',
                      disabled && 'opacity-45',
                    )}
                  >
                    {selectable ? (
                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select row ${row.id}`}
                          disabled={disabled}
                          checked={Boolean(selectedIds?.has(row.id))}
                          onChange={(e) => {
                            const next = new Set(selectedIds ?? [])
                            if (e.target.checked) next.add(row.id)
                            else next.delete(row.id)
                            onSelectionChange?.(next)
                          }}
                        />
                      </td>
                    ) : null}
                    {visibleColumns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          dense ? 'px-4 py-1.5' : 'px-4 py-2.5',
                          column.align === 'right' && 'text-right tnum',
                        )}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                </React.Fragment>
              )
            })}
          </tbody>
          {summaryRow ? (
            <tfoot>
              <tr className="border-t-2 border-separator font-semibold">
                {selectable ? <td /> : null}
                {visibleColumns.map((column) => (
                  <td
                    key={column.key}
                    className={cn('px-4 py-2.5', column.align === 'right' && 'text-right tnum')}
                  >
                    {summaryRow[column.key] ?? null}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    )
  }

  return (
    <div>
      {showToolbar ? (
        <TableToolbar
          searchLabel={typeof toolbar!.search === 'string' ? toolbar!.search : 'Search'}
          searchEnabled={Boolean(toolbar!.search)}
          query={query}
          onQuery={(value) => (controlled ? table!.setQuery(value) : setClientQuery(value))}
          // Only a server round trip is worth waiting for; a local filter is instant.
          pending={serverMode ? table!.searchPending : false}
          filters={toolbar!.filters}
          actions={toolbar!.actions}
        />
      ) : null}
      {body()}
      {showFooter ? (
        <TablePagination
          page={page}
          size={size}
          total={totalRows}
          shownOnPage={shown.length}
          paged={controlled}
          onPage={(p) => table?.setPage(p)}
          onSize={(s) => table?.setSize(s)}
        />
      ) : null}
    </div>
  )
}

function TableToolbar({ searchEnabled, searchLabel, query, onQuery, pending, filters, actions }: {
  searchEnabled: boolean
  searchLabel: string
  query: string
  onQuery: (value: string) => void
  pending: boolean
  filters?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-separator px-4 py-3">
      {searchEnabled ? <SearchInput value={query} onChange={onQuery} placeholder={searchLabel} pending={pending} /> : null}
      {filters ? <div className="flex flex-wrap items-center gap-2">{filters}</div> : null}
      {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/** The one search box. Every list that can be searched uses this, with the same icon and clear button. */
export function SearchInput({ value, onChange, placeholder = 'Search', pending, className, id }: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  pending?: boolean
  className?: string
  id?: string
}) {
  return (
    <div className={cn('relative', className ?? 'w-full sm:w-64')}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-label2" aria-hidden />
      <input
        id={id}
        type="search"
        value={value}
        aria-label={placeholder}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-control border border-separator bg-surface pl-8 pr-8 text-body outline-none transition-colors placeholder:text-label2 hover:border-label2/40 focus:border-accent"
      />
      {pending ? (
        <Spinner className="absolute right-2.5 top-1/2 -translate-y-1/2 text-label2" />
      ) : value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-label2 hover:text-label"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
}

/** Which rows of how many, and how to reach the rest. Exported so its arithmetic can be tested. */
export function TablePagination({ page, size, total, shownOnPage, paged, onPage, onSize }: {
  page: number
  size: number
  total: number
  shownOnPage: number
  /** False for an embedded table that shows everything it was given: the count alone, no controls. */
  paged: boolean
  onPage: (page: number) => void
  onSize: (size: number) => void
}) {
  const first = total === 0 ? 0 : page * size + 1
  const last = page * size + shownOnPage
  const totalPages = Math.max(1, Math.ceil(total / Math.max(size, 1)))

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-separator px-4 py-2.5 text-sm2 text-label2">
      <p className="tnum">
        Showing {num(first)}–{num(last)} of {num(total)}
      </p>
      {paged ? (
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <span>Rows</span>
            <Select
              value={String(size)}
              onChange={(value) => onSize(Number(value))}
              options={PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
              className="w-20"
            />
          </label>
          <span className="tnum">Page {num(page + 1)} of {num(totalPages)}</span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              aria-label="Previous page"
              disabled={page === 0}
              onClick={() => onPage(page - 1)}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              aria-label="Next page"
              disabled={page + 1 >= totalPages}
              onClick={() => onPage(page + 1)}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function compare(a: SortKey | SortKey[], b: SortKey | SortKey[]): number {
  // Arrays compare left to right, which is how "structure, then sequence" is expressed.
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const result = compare(a[i] ?? '', b[i] ?? '')
      if (result !== 0) return result
    }
    return 0
  }
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

function errorMessageOf(error: unknown): string {
  if (error && typeof error === 'object' && 'detail' in error) return String((error as { detail: string }).detail)
  if (error instanceof Error) return error.message
  return 'The server did not respond as expected.'
}
