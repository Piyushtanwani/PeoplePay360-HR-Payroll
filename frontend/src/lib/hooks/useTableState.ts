import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDebouncedValue } from './useDebouncedValue'

export type SortDirection = 'asc' | 'desc'

export interface TableState {
  page: number
  size: number
  sort: string | null
  dir: SortDirection
  q: string
}

/**
 * Exactly the parameters the server understands.
 *
 * Declared as a type rather than an interface so it carries an implicit index signature, which is
 * what lets it be spread alongside a screen's own filters into a request.
 */
export type TableQuery = {
  page: number
  size: number
  sort?: string
  q?: string
}

export interface TableController {
  state: TableState
  /** Ready to spread into a request. The search term here is the debounced one. */
  params: TableQuery
  setPage: (page: number) => void
  setSize: (size: number) => void
  setSort: (column: string) => void
  setQuery: (q: string) => void
  reset: () => void
  /** True while the typed search has not yet been sent, so the table can show it is about to change. */
  searchPending: boolean
}

export const PAGE_SIZES = [20, 50, 100]

/**
 * Page, size, sort and search for one table, kept in the address bar.
 *
 * Two rules make the behaviour predictable. Changing anything that alters which rows match resets to
 * the first page, because staying on page four of a different result set shows nothing. And the search
 * term is debounced before it reaches `params`, so typing sends one request rather than one per letter.
 *
 * @param options.prefix distinguishes two tables on the same page, for example `ps.` for a payslip tab.
 * @param options.url    set false inside a panel, where writing to the address bar would fight the page.
 */
export function useTableState(options: {
  defaultSort?: string
  defaultDir?: SortDirection
  size?: number
  prefix?: string
  url?: boolean
  debounceMs?: number
} = {}): TableController {
  const {
    defaultSort = null,
    defaultDir = 'asc',
    size: defaultSize = PAGE_SIZES[0],
    prefix = '',
    url = true,
    debounceMs = 300,
  } = options

  const [searchParams, setSearchParams] = useSearchParams()
  const [local, setLocal] = React.useState<Partial<TableState>>({})

  const key = React.useCallback((name: string) => `${prefix}${name}`, [prefix])

  const read = React.useCallback(
    (name: keyof TableState) => (url ? searchParams.get(key(name)) : (local[name] ?? null)),
    [url, searchParams, key, local],
  )

  const rawPage = read('page')
  const rawSize = read('size')
  const rawSort = read('sort')
  const rawDir = read('dir')
  const rawQuery = read('q')

  const state: TableState = {
    page: Math.max(0, Number(rawPage ?? 0) || 0),
    size: PAGE_SIZES.includes(Number(rawSize)) ? Number(rawSize) : defaultSize,
    sort: (rawSort as string | null) ?? defaultSort,
    dir: rawDir === 'desc' ? 'desc' : rawDir === 'asc' ? 'asc' : defaultDir,
    q: (rawQuery as string | null) ?? '',
  }

  const write = React.useCallback(
    (patch: Partial<TableState>) => {
      if (!url) {
        setLocal((current) => ({ ...current, ...patch }))
        return
      }
      setSearchParams(
        (current) => {
          const merged = new URLSearchParams(current)
          for (const [name, value] of Object.entries(patch)) {
            const param = key(name)
            const isDefault =
              (name === 'page' && value === 0) ||
              (name === 'size' && value === defaultSize) ||
              (name === 'sort' && value === defaultSort) ||
              (name === 'dir' && value === defaultDir) ||
              value === '' ||
              value === null
            if (isDefault) merged.delete(param)
            else merged.set(param, String(value))
          }
          return merged
        },
        { replace: true },
      )
    },
    [url, setSearchParams, key, defaultSize, defaultSort, defaultDir],
  )

  const setPage = React.useCallback((page: number) => write({ page: Math.max(0, page) }), [write])
  // Anything that changes the result set returns to the first page.
  const setSize = React.useCallback((size: number) => write({ size, page: 0 }), [write])
  const setQuery = React.useCallback((q: string) => write({ q, page: 0 }), [write])
  const setSort = React.useCallback(
    (column: string) => {
      const nextDir: SortDirection = state.sort === column && state.dir === 'asc' ? 'desc' : 'asc'
      write({ sort: column, dir: nextDir, page: 0 })
    },
    [write, state.sort, state.dir],
  )
  const reset = React.useCallback(
    () => write({ page: 0, size: defaultSize, sort: defaultSort, dir: defaultDir, q: '' }),
    [write, defaultSize, defaultSort, defaultDir],
  )

  const debouncedQuery = useDebouncedValue(state.q, debounceMs)

  const params: TableQuery = React.useMemo(
    () => ({
      page: state.page,
      size: state.size,
      ...(state.sort ? { sort: `${state.sort},${state.dir}` } : {}),
      ...(debouncedQuery ? { q: debouncedQuery } : {}),
    }),
    [state.page, state.size, state.sort, state.dir, debouncedQuery],
  )

  return { state, params, setPage, setSize, setSort, setQuery, reset, searchPending: debouncedQuery !== state.q }
}
