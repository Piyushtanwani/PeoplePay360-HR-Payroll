import { timeZone } from './dates'

export let CURRENCY = 'INR'
export function setCurrency(c: string) {
  CURRENCY = c
}

/**
 * One money policy across the whole app, so the same figure never reads two ways.
 *
 * `money` in tables: whole units, standard notation. `moneyExact` in detail views and confirmations,
 * where the paise matter. `moneyCompact` only on headline tiles and chart axes, where space is the
 * constraint. A payslip's net used to read as an abbreviated figure in the list and a full one in the
 * panel beside it.
 */
function format(value: number, opts: { decimals: number; compact: boolean; sign?: boolean }) {
  const out = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: CURRENCY,
    maximumFractionDigits: opts.decimals,
    minimumFractionDigits: opts.decimals,
    notation: opts.compact ? 'compact' : 'standard',
  }).format(value)
  return opts.sign && value > 0 ? `+${out}` : out
}

/** Table figures: no decimals, full notation. */
export function money(value: number | null | undefined, opts: { sign?: boolean } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return format(value, { decimals: 0, compact: false, sign: opts.sign })
}

/** Detail views and confirmations, where the exact amount is the point. */
export function moneyExact(value: number | null | undefined, opts: { sign?: boolean } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return format(value, { decimals: 2, compact: false, sign: opts.sign })
}

/** Headline tiles and chart axes only. Falls back to full notation below a lakh, where it reads worse. */
export function moneyCompact(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const compact = Math.abs(value) >= 100_000
  return format(value, { decimals: compact ? 1 : 0, compact })
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

/**
 * Two kinds of value, formatted differently on purpose.
 *
 * A calendar date such as `2026-09-01` is already a day and must never be shifted; converting it to
 * a timezone can move it to the day before. An instant such as a check-in stamp is a moment in time
 * and is shown in the company timezone, so it matches the times the server classified attendance
 * against rather than wherever the reader's laptop happens to be.
 */
const CALENDAR_ZONE = 'UTC'

let formatters: { zone: string; date: Intl.DateTimeFormat; dateShort: Intl.DateTimeFormat; time: Intl.DateTimeFormat } | null = null

function forZone(zone: string) {
  if (!formatters || formatters.zone !== zone) {
    formatters = {
      zone,
      date: new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: zone }),
      dateShort: new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: zone }),
      time: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zone }),
    }
  }
  return formatters
}

/** True for `YYYY-MM-DD`, which carries a day but no moment. */
function isCalendarDate(value: string) {
  return value.length <= 10
}

function instantOf(value: string) {
  return new Date(isCalendarDate(value) ? `${value}T00:00:00Z` : value)
}

function zoneFor(value: string) {
  return isCalendarDate(value) ? CALENDAR_ZONE : timeZone()
}

export function fmtDate(d?: string | null) {
  if (!d) return '—'
  return forZone(zoneFor(d)).date.format(instantOf(d))
}/** A date range with an en dash, which is the separator used everywhere a period is shown. */
export function fmtRange(from?: string | null, to?: string | null) {
  if (!from && !to) return '—'
  return `${fmtDate(from)} – ${fmtDate(to)}`
}
/** Turns a stored code such as MISSING_CHECKOUT into "Missing checkout" for a label. */
export function labelize(code?: string | null) {
  if (!code) return '—'
  return code.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())
}
export function fmtTime(iso?: string | null) {
  if (!iso) return '—'
  return forZone(timeZone()).time.format(new Date(iso))
}
export function fmtDateTime(iso?: string | null) {
  if (!iso) return '—'
  return `${fmtDate(iso)} ${fmtTime(iso)}`
}
export function fmtPeriod(period: string) {
  const [y, m] = period.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1))
}export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}
