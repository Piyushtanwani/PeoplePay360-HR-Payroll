import * as React from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/cn'
import { EmptyState, TableSkeleton } from './primitives'

export interface Column<T> {
  key: string
  header: React.ReactNode
  render: (row: T) => React.ReactNode
  sortValue?: (row: T) => string | number
  align?: 'left' | 'right'
  width?: string
  className?: string
}

export function DataTable<T extends { id: number | string }>({
  rows, columns, loading, onRowClick, empty, selectable, selectedIds, onSelectionChange, rowDisabled, dense,
}: {
  rows: T[]
  columns: Column<T>[]
  loading?: boolean
  onRowClick?: (row: T) => void
  empty?: React.ReactNode
  selectable?: boolean
  selectedIds?: Set<T['id']>
  onSelectionChange?: (ids: Set<T['id']>) => void
  rowDisabled?: (row: T) => boolean
  dense?: boolean
}) {
  const [sort, setSort] = React.useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)

  const sorted = React.useMemo(() => {
    if (!sort) return rows
    const column = columns.find((c) => c.key === sort.key)
    if (!column?.sortValue) return rows
    return [...rows].sort((a, b) => {
      const av = column.sortValue!(a)
      const bv = column.sortValue!(b)
      const result = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sort.dir === 'asc' ? result : -result
    })
  }, [rows, sort, columns])

  if (loading) return <TableSkeleton cols={Math.min(columns.length, 6)} />
  if (!rows.length) return <>{empty ?? <EmptyState title="Nothing here yet" description="Adjust your filters or create the first record." />}</>

  const allSelected = selectable && selectedIds && rows.length > 0 && rows.every((r) => selectedIds.has(r.id))

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-body">
        <thead>
          <tr className="border-b border-separator text-left">
            {selectable ? (
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={Boolean(allSelected)}
                  onChange={(e) => onSelectionChange?.(new Set(e.target.checked ? rows.filter((r) => !rowDisabled?.(r)).map((r) => r.id) : []))}
                />
              </th>
            ) : null}
            {columns.map((column) => (
              <th
                key={column.key}
                style={{ width: column.width }}
                className={cn('px-4 py-2.5 text-xs2 font-semibold uppercase tracking-wide text-label2', column.align === 'right' && 'text-right')}
              >
                {column.sortValue ? (
                  <button
                    className="inline-flex items-center gap-1 hover:text-label"
                    onClick={() =>
                      setSort((prev) => (prev?.key === column.key ? { key: column.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key: column.key, dir: 'asc' }))
                    }
                  >
                    {column.header}
                    {sort?.key === column.key ? (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : null}
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const disabled = rowDisabled?.(row)
            return (
              <tr
                key={String(row.id)}
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
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(dense ? 'px-4 py-1.5' : 'px-4 py-2.5', column.align === 'right' && 'text-right tnum', column.className)}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
