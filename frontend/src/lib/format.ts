export let CURRENCY = 'INR'
export function setCurrency(c: string) {
  CURRENCY = c
}

export function money(value: number | null | undefined, opts: { compact?: boolean; sign?: boolean } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  // Compact notation only earns its place above a lakh; below that it reads worse than the full figure.
  const compact = Boolean(opts.compact) && Math.abs(value) >= 100_000
  const fmt = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: CURRENCY,
    maximumFractionDigits: compact ? 2 : opts.compact ? 0 : 2,
    minimumFractionDigits: compact ? 0 : opts.compact ? 0 : 2,
    notation: compact ? 'compact' : 'standard',
  })
  const out = fmt.format(value)
  return opts.sign && value > 0 ? `+${out}` : out
}

export function num(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)
}

export function pct(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined) return '—'
  return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits }).format(value)}%`
}

export function minutesToHours(mins: number | null | undefined) {
  if (!mins) return '0h00'
  const h = Math.floor(mins / 60)
  const m = Math.abs(mins % 60)
  return `${h}h${String(m).padStart(2, '0')}`
}

const DATE = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const DATE_SHORT = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' })
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })

export function fmtDate(d?: string | null) {
  if (!d) return '—'
  return DATE.format(new Date(d.length <= 10 ? `${d}T00:00:00` : d))
}
export function fmtDateShort(d?: string | null) {
  if (!d) return '—'
  return DATE_SHORT.format(new Date(d.length <= 10 ? `${d}T00:00:00` : d))
}
export function fmtTime(iso?: string | null) {
  if (!iso) return '—'
  return TIME.format(new Date(iso))
}
export function fmtDateTime(iso?: string | null) {
  if (!iso) return '—'
  return `${fmtDate(iso)} ${fmtTime(iso)}`
}
export function fmtPeriod(period: string) {
  const [y, m] = period.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1))
}
export function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
export function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}
