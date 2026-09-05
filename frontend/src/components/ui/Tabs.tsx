import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Chip, Tooltip } from './primitives'
import type { Tone } from './status'

export interface TabItem {
  value: string
  label: React.ReactNode
  /** A count beside the label, for a tab whose contents need attention. */
  count?: number | null
  countTone?: Tone
  hidden?: boolean
  disabled?: boolean
  disabledReason?: string
}

const TRIGGER_CLASS =
  'rounded-[8px] px-3 py-1.5 text-sm2 font-medium text-label2 transition-colors ' +
  'data-[state=active]:bg-surface data-[state=active]:text-label data-[state=active]:shadow-sm ' +
  'hover:text-label disabled:cursor-not-allowed disabled:opacity-40'

/**
 * The one tab strip. Six screens each carried their own copy of this class string, which is six
 * chances for them to drift apart.
 *
 * @param urlKey puts the active tab in the address bar, so a tab is a link and the back button works.
 */
export function Tabs({ items, value, defaultValue, onValueChange, urlKey, className, children }: {
  items: TabItem[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  urlKey?: string
  className?: string
  children: React.ReactNode
}) {
  const [params, setParams] = useSearchParams()
  const visible = items.filter((item) => !item.hidden)
  const fallback = defaultValue ?? visible[0]?.value ?? ''

  const fromUrl = urlKey ? params.get(urlKey) : null
  const active = value ?? (urlKey ? (visible.some((i) => i.value === fromUrl) ? fromUrl! : fallback) : undefined)

  const handleChange = (next: string) => {
    if (urlKey) {
      setParams(
        (current) => {
          const merged = new URLSearchParams(current)
          if (next === fallback) merged.delete(urlKey)
          else merged.set(urlKey, next)
          return merged
        },
        { replace: true },
      )
    }
    onValueChange?.(next)
  }

  return (
    <TabsPrimitive.Root
      value={active}
      defaultValue={value || urlKey ? undefined : fallback}
      onValueChange={handleChange}
      className={className}
    >
      <TabsPrimitive.List className="mb-4 inline-flex rounded-control bg-surface2 p-0.5">
        {visible.map((item) => {
          const trigger = (
            <TabsPrimitive.Trigger key={item.value} value={item.value} disabled={item.disabled} className={TRIGGER_CLASS}>
              <span className="inline-flex items-center gap-1.5">
                {item.label}
                {item.count !== null && item.count !== undefined ? (
                  <Chip tone={item.countTone ?? 'neutral'}>{item.count}</Chip>
                ) : null}
              </span>
            </TabsPrimitive.Trigger>
          )
          return item.disabled && item.disabledReason ? (
            <Tooltip key={item.value} content={item.disabledReason}>
              <span className="inline-flex">{trigger}</span>
            </Tooltip>
          ) : (
            trigger
          )
        })}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  )
}

export function TabPanel({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  return (
    <TabsPrimitive.Content value={value} className={cn('outline-none', className)}>
      {children}
    </TabsPrimitive.Content>
  )
}
