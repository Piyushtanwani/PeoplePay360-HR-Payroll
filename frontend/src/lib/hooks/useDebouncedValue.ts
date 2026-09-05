import * as React from 'react'

/**
 * Delays a changing value until it settles.
 *
 * Search boxes used to fire a request per keystroke, so typing a name sent five queries and the
 * answers could arrive out of order.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [settled, setSettled] = React.useState(value)
  React.useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return settled
}
