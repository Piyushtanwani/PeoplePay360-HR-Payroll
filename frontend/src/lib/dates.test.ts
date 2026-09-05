import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  combineDateTime, currentPeriod, daysAgo, lastClosedPeriod, monthBounds,
  nearbyYears, recentPeriods, timeOf, todayIso, yearBounds,
} from './dates'

// A fixed clock, because the point of this module is that nothing is written as a literal date.
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 6, 14, 30))
})
afterEach(() => vi.useRealTimers())

describe('dates', () => {
  it('reads today in local terms, not UTC', () => {
    vi.setSystemTime(new Date(2026, 8, 6, 23, 45))
    expect(todayIso()).toBe('2026-09-06')
  })

  it('counts back across a month boundary', () => {
    expect(daysAgo(30)).toBe('2026-08-07')
    expect(daysAgo(0)).toBe('2026-09-06')
  })

  it('names the current period and the last closed one', () => {
    expect(currentPeriod()).toBe('2026-09')
    expect(lastClosedPeriod()).toBe('2026-08')
  })

  it('rolls the last closed period back over a year boundary', () => {
    vi.setSystemTime(new Date(2026, 0, 15))
    expect(lastClosedPeriod()).toBe('2025-12')
  })

  it('lists recent periods newest first', () => {
    expect(recentPeriods(3)).toEqual(['2026-09', '2026-08', '2026-07'])
  })

  it('finds the first and last day of a month, including February', () => {
    expect(monthBounds('2026-09')).toEqual({ start: '2026-09-01', end: '2026-09-30' })
    expect(monthBounds('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' })
    expect(monthBounds('2028-02').end).toBe('2028-02-29')
  })

  it('bounds a year', () => {
    expect(yearBounds(2026)).toEqual({ start: '2026-01-01', end: '2026-12-31' })
  })

  // This conversion is what made the attendance resolve action work. Sending "17:30" to a field
  // typed as an instant returned 400, and the failure was silent on screen.
  it('turns a date and a wall-clock time into a full instant', () => {
    const stamp = combineDateTime('2026-09-01', '17:30')
    expect(stamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    const parsed = new Date(stamp)
    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(8)
    expect(parsed.getDate()).toBe(1)
    expect(parsed.getHours()).toBe(17)
    expect(parsed.getMinutes()).toBe(30)
  })

  it('treats midnight as a real time rather than a missing one', () => {
    expect(new Date(combineDateTime('2026-09-01', '00:00')).getHours()).toBe(0)
  })

  it('reads a clock time back out of a stored instant, and nothing out of nothing', () => {
    expect(timeOf(combineDateTime('2026-09-01', '09:05'))).toBe('09:05')
    expect(timeOf(null)).toBe('')
    expect(timeOf(undefined)).toBe('')
  })

  it('offers the years around today for a picker', () => {
    expect(nearbyYears()).toEqual([2027, 2026, 2025])
  })
})
