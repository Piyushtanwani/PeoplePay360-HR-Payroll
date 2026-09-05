import * as React from 'react'
import { cn } from '@/lib/cn'
import { CURRENCY } from '@/lib/format'
import { Select } from './Select'

export function Field({ label, hint, error, required, htmlFor, children, className }: {
  label?: string; hint?: string; error?: string; required?: boolean; htmlFor?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="block text-sm2 font-medium text-label">
          {label}
          {required ? <span className="ml-0.5 text-bad">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <p className="text-xs2 text-bad">{error}</p> : hint ? <p className="text-xs2 text-label2">{hint}</p> : null}
    </div>
  )
}

const inputBase =
  'h-9 w-full rounded-control border border-separator bg-surface px-3 text-body outline-none transition-colors placeholder:text-label2 hover:border-label2/40 focus:border-accent disabled:opacity-50'

export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function TextInput({ className, invalid, ...props }, ref) {
    return <input ref={ref} className={cn(inputBase, invalid && 'border-bad', className)} {...props} />
  },
)

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...props }, ref) {
    return <textarea ref={ref} rows={3} className={cn(inputBase, 'h-auto py-2', className)} {...props} />
  },
)

export function MoneyInput({ value, onChange, disabled, id, invalid }: { value: number | null; onChange: (v: number) => void; disabled?: boolean; id?: string; invalid?: boolean }) {
  return (
    <div className={cn('flex h-9 items-center rounded-control border bg-surface px-3', invalid ? 'border-bad' : 'border-separator focus-within:border-accent')}>
      <span className="mr-2 text-sm2 text-label2">{CURRENCY === 'INR' ? '₹' : CURRENCY}</span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        disabled={disabled}
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="tnum w-full bg-transparent text-body outline-none"
      />
    </div>
  )
}

/**
 * A wall-clock time.
 *
 * `label` names the field for anyone not looking at the column heading, which matters most in a grid
 * where seven rows each hold a start and an end.
 */
export function TimeField({ value, onChange, disabled, id, label }: { value: string; onChange: (v: string) => void; disabled?: boolean; id?: string; label?: string }) {
  return <input id={id} type="time" aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={cn(inputBase, 'tnum')} />
}

export function DateField({ value, onChange, min, max, id, disabled }: { value: string; onChange: (v: string) => void; min?: string; max?: string; id?: string; disabled?: boolean }) {
  return <input id={id} type="date" value={value} min={min} max={max} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={cn(inputBase, 'tnum')} />
}

export function DateRangePicker({ from, to, onChange, className }: {
  from: string
  to: string
  onChange: (range: { from: string; to: string }) => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <DateField value={from} onChange={(v) => onChange({ from: v, to })} />
      <span className="text-label2" aria-hidden>–</span>
      <DateField value={to} min={from} onChange={(v) => onChange({ from, to: v })} />
    </div>
  )
}

/** A plain number field with the same chrome as every other input. */
export function NumberInput({ value, onChange, min, max, step, suffix, id, disabled, invalid, className }: {
  value: number | null
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  id?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-9 items-center rounded-control border bg-surface px-3',
        invalid ? 'border-bad' : 'border-separator focus-within:border-accent',
        disabled && 'opacity-50',
        className,
      )}
    >
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="tnum w-full bg-transparent text-body outline-none"
      />
      {suffix ? <span className="ml-2 shrink-0 text-sm2 text-label2">{suffix}</span> : null}
    </div>
  )
}

/**
 * Month picker built from the clock, so its options never go stale, and always including whatever is
 * currently selected even if that month falls outside the window.
 *
 * @param clearable adds an "All periods" option, without which a chosen month could not be undone
 *                  except by reloading the page.
 */
export function MonthPicker({ value, onChange, months = 18, clearable, placeholder = 'All periods', className }: {
  value: string
  onChange: (period: string) => void
  months?: number
  clearable?: boolean
  placeholder?: string
  className?: string
}) {
  const options = React.useMemo(() => {
    const now = new Date()
    const list = Array.from({ length: months }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return { value: period, label: d.toLocaleString('en-GB', { month: 'long', year: 'numeric' }) }
    })
    if (value && !list.some((o) => o.value === value)) {
      const [y, m] = value.split('-').map(Number)
      list.unshift({
        value,
        label: new Date(y, m - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' }),
      })
    }
    if (clearable) list.unshift({ value: '', label: placeholder })
    return list
  }, [months, value, clearable, placeholder])
  return <Select value={value} onChange={onChange} options={options} placeholder={placeholder} className={className} />
}
