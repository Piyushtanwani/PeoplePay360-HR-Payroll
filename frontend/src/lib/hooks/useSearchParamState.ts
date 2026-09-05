import * as React from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * A piece of page state that lives in the address bar, so a filtered view is a link someone can send
 * and the back button behaves.
 *
 * Merges rather than replaces, so two of these on one page, or a table's own paging, do not wipe each
 * other out. A value equal to the default is removed from the URL rather than written, which keeps
 * links short and readable.
 */
export function useSearchParamState<T extends string | number | null>(
  key: string,
  defaultValue: T,
  parse: (raw: string) => T = (raw) => raw as T,
): [T, (next: T) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get(key)
  const value = raw === null ? defaultValue : parse(raw)

  const set = React.useCallback(
    (next: T) => {
      setParams(
        (current) => {
          const merged = new URLSearchParams(current)
          if (next === null || next === '' || next === defaultValue) merged.delete(key)
          else merged.set(key, String(next))
          return merged
        },
        { replace: true },
      )
    },
    [key, defaultValue, setParams],
  )

  return [value, set]
}

/** Numeric variant, for id filters that arrive from a link. */
export function useNumberParamState(
  key: string,
  defaultValue: number | null = null,
): [number | null, (next: number | null) => void] {
  return useSearchParamState<number | null>(key, defaultValue, (raw) => {
    const n = Number(raw)
    return Number.isFinite(n) ? n : defaultValue
  })
}
