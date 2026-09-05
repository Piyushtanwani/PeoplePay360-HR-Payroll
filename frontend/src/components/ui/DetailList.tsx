import * as React from 'react'
import { cn } from '@/lib/cn'
import { Tooltip } from './primitives'

export interface DetailItem {
  label: React.ReactNode
  value: React.ReactNode
  /** An explanation on the label, for a field whose meaning is not self-evident. */
  hint?: string
  /** Tabular figures, so a column of amounts lines up. */
  tnum?: boolean
  hidden?: boolean
}

/**
 * Label and value pairs in a panel.
 *
 * Seven screens each hand-wrote this markup, with different padding and different separators, so a
 * contract's details and a payslip's details looked like they came from different applications.
 */
export function DetailList({ items, bordered = true, dense, className }: {
  items: DetailItem[]
  bordered?: boolean
  dense?: boolean
  className?: string
}) {
  const visible = items.filter((item) => !item.hidden)
  return (
    <dl
      className={cn(
        'divide-y divide-separator',
        bordered && 'rounded-card border border-separator',
        className,
      )}
    >
      {visible.map((item, index) => (
        <div
          key={index}
          className={cn('flex items-start justify-between gap-4 px-4 text-sm2', dense ? 'py-1.5' : 'py-2.5')}
        >
          <dt className="shrink-0 text-label2">
            {item.hint ? (
              <Tooltip content={item.hint}>
                <span className="cursor-help border-b border-dotted border-separator">{item.label}</span>
              </Tooltip>
            ) : (
              item.label
            )}
          </dt>
          <dd className={cn('min-w-0 text-right font-medium', item.tnum && 'tnum')}>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
