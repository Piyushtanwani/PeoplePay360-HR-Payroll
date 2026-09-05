import * as React from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Spinner } from './primitives'

export interface SelectOption<T extends string | number> {
  value: T
  label: string
  description?: string
  group?: string
  disabled?: boolean
  disabledReason?: string
  swatch?: string
}

export interface SelectProps<T extends string | number> {
  value: T | null | undefined
  onChange: (value: T) => void
  options: SelectOption<T>[]
  placeholder?: string
  loading?: boolean
  disabled?: boolean
  clearable?: boolean
  onClear?: () => void
  emptyMessage?: string
  createLabel?: string
  onCreate?: () => void
  id?: string
  className?: string
  invalid?: boolean
}

/**
 * Enumerated values are never typed by hand: this replaces every native
 * `<select>` and becomes searchable past eight options (A4).
 */
export function Select<T extends string | number>({
  value, onChange, options, placeholder = 'Select…', loading, disabled, clearable, onClear,
  emptyMessage = 'Nothing matches your search.', createLabel, onCreate, id, className, invalid,
}: SelectProps<T>) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const searchable = options.length > 8
  const selected = options.find((o) => o.value === value)

  const filtered = React.useMemo(() => {
    if (!query) return options
    const q = query.toLowerCase()
    return options.filter((o) => `${o.label} ${o.description ?? ''}`.toLowerCase().includes(q))
  }, [options, query])

  const groups = React.useMemo(() => {
    const map = new Map<string, SelectOption<T>[]>()
    for (const option of filtered) {
      const key = option.group ?? ''
      map.set(key, [...(map.get(key) ?? []), option])
    }
    return Array.from(map.entries())
  }, [filtered])

  return (
    <Popover.Root open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery('') }}>
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-control border bg-surface px-3 text-left text-body transition-colors',
            'disabled:cursor-not-allowed disabled:opacity-50',
            invalid ? 'border-bad' : 'border-separator hover:border-label2/40',
            className,
          )}
        >
          <span className={cn('flex min-w-0 items-center gap-2 truncate', !selected && 'text-label2')}>
            {selected?.swatch ? <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: selected.swatch }} /> : null}
            {selected?.label ?? placeholder}
          </span>
          <span className="flex items-center gap-1">
            {clearable && selected ? (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear"
                onClick={(e) => { e.stopPropagation(); onClear?.() }}
                className="rounded px-1 text-label2 hover:text-label"
              >
                ×
              </span>
            ) : null}
            <ChevronDown className="h-4 w-4 shrink-0 text-label2" />
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[220px] animate-in overflow-hidden rounded-card border border-separator bg-surface shadow-sheet"
        >
          {searchable ? (
            <div className="flex items-center gap-2 border-b border-separator px-3 py-2">
              <Search className="h-3.5 w-3.5 text-label2" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full bg-transparent text-sm2 outline-none placeholder:text-label2"
              />
            </div>
          ) : null}
          <div className="max-h-64 overflow-y-auto p-1">
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-6 text-sm2 text-label2">
                <Spinner /> Loading options…
              </div>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm2 text-label2">{emptyMessage}</p>
            ) : (
              groups.map(([group, items]) => (
                <div key={group}>
                  {group ? <p className="px-3 pb-1 pt-2 text-xs2 font-semibold uppercase tracking-wide text-label2">{group}</p> : null}
                  {items.map((option) => (
                    <button
                      key={String(option.value)}
                      type="button"
                      disabled={option.disabled}
                      title={option.disabled ? option.disabledReason : undefined}
                      onClick={() => { onChange(option.value); setOpen(false); setQuery('') }}
                      className={cn(
                        'flex w-full items-start gap-2 rounded-[8px] px-2.5 py-1.5 text-left transition-colors',
                        option.disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-surface2',
                      )}
                    >
                      <span className="flex h-5 w-4 items-center justify-center">
                        {option.value === value ? <Check className="h-3.5 w-3.5 text-accent" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-body">
                          {option.swatch ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: option.swatch }} /> : null}
                          {option.label}
                        </span>
                        {option.description ? <span className="block truncate text-xs2 text-label2">{option.description}</span> : null}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
          {onCreate ? (
            <button
              type="button"
              onClick={() => { onCreate(); setOpen(false) }}
              className="w-full border-t border-separator px-3 py-2 text-left text-sm2 text-accent hover:bg-surface2"
            >
              {createLabel ?? 'Create new…'}
            </button>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
