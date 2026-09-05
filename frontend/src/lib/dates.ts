/**
 * Every date the interface invents comes from here.
 *
 * Dates used to be written as literals scattered across a dozen screens, which meant the app silently
 * aged: a filter that read "1 August 2026" stayed that way whatever today was.
 */

/** The company timezone, taken from the signed-in session so it matches what the server classifies against. */
let TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

export function setTimeZone(zone: string | null | undefined) {
  if (zone) TIMEZONE = zone
}

export function timeZone() {
  return TIMEZONE
}

/** `YYYY-MM-DD` for a Date, in local terms rather than UTC, so "today" is not yesterday after 18:30. */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function todayIso(): string {
  return toIsoDate(new Date())
}

export function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toIsoDate(d)
}

/** `YYYY-MM` for the current month. */
export function currentPeriod(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** The month before this one, which is the one payroll is usually looking at. */
export function lastClosedPeriod(): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** The last `count` months, newest first, as `YYYY-MM`. */
export function recentPeriods(count = 12): string[] {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

/** First and last day of a `YYYY-MM` period. */
export function monthBounds(period: string): { start: string; end: string } {
  const [year, month] = period.split('-').map(Number)
  return { start: toIsoDate(new Date(year, month - 1, 1)), end: toIsoDate(new Date(year, month, 0)) }
}

export function yearBounds(year: number): { start: string; end: string } {
  return { start: `${year}-01-01`, end: `${year}-12-31` }
}

/**
 * Combines a calendar date with a wall-clock time into an instant the server can store.
 *
 * Attendance stamps are instants, but people think in clock times, so the interface asks for
 * "17:30" and converts here. Sending the bare time is what made the resolve action fail.
 */
export function combineDateTime(dateIso: string, time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const [year, month, day] = dateIso.split('-').map(Number)
  const d = new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0)
  return d.toISOString()
}

/** The `HH:mm` of an instant, for prefilling a time field from a stored stamp. */
export function timeOf(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** The current year, plus and minus one, for a year picker. */
export function nearbyYears(): number[] {
  const y = new Date().getFullYear()
  return [y + 1, y, y - 1]
}
