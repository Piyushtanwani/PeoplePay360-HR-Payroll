import * as React from 'react'
import * as Popover from '@radix-ui/react-popover'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { StatusBadge } from './primitives'
import { legendFor } from './status'

/**
 * The "?" beside a heading.
 *
 * Anything a reader cannot work out from what is on screen belongs in one of these, rather than in a
 * document nobody opens or a tooltip that vanishes while being read.
 */
export function HelpPopover({ title, children, size = 'md', side = 'bottom', align = 'end', label }: {
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  label?: string
}) {
  const widths = { sm: 'w-[280px]', md: 'w-[360px]', lg: 'w-[440px]' }
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={label ?? `About ${title}`}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-label2 transition-colors hover:bg-surface2 hover:text-label"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            'z-50 max-h-[70vh] overflow-y-auto rounded-card border border-separator bg-surface p-4 shadow-sheet',
            widths[size],
          )}
        >
          <p className="text-sm2 font-semibold">{title}</p>
          <div className="mt-2 space-y-3 text-sm2 text-label2">{children}</div>
          <Popover.Arrow className="fill-[var(--separator)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** Term and explanation pairs inside a help panel. */
export function HelpItems({ items }: { items: { term: React.ReactNode; text: React.ReactNode }[] }) {
  return (
    <dl className="space-y-2.5">
      {items.map((item, index) => (
        <div key={index}>
          <dt className="font-medium text-label">{item.term}</dt>
          <dd className="mt-0.5">{item.text}</dd>
        </div>
      ))}
    </dl>
  )
}

/** What each status on this screen means, so the colours are never the only clue. */
export function StatusLegend({ statuses, title = 'What the statuses mean', inline }: {
  statuses: string[]
  title?: string
  inline?: boolean
}) {
  const rows = (
    <dl className="space-y-2">
      {legendFor(statuses).map((entry) => (
        <div key={entry.status} className="flex items-start gap-2.5">
          <dt className="shrink-0">
            <StatusBadge status={entry.status} tooltip={false} />
          </dt>
          <dd className="text-sm2 text-label2">{entry.description}</dd>
        </div>
      ))}
    </dl>
  )
  if (inline) return rows
  return (
    <HelpPopover title={title} size="lg">
      {rows}
    </HelpPopover>
  )
}
