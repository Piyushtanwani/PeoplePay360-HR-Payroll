import { setupServer } from 'msw/node'
import { handlers } from './msw/handlers'

/**
 * The seeded backend, served in-process.
 *
 * These are the same handlers and the same dataset the application would talk to, so a test that
 * uses them exercises the real client, the real hooks and the real permission checks. A test that
 * stubs a hook proves the component; this proves the wiring between them.
 */
export const server = setupServer(...handlers)

/** A bearer token the mock handlers accept for one of the seeded accounts. */
export function tokenFor(userId: number) {
  return `mock.${userId}.token`
}

export const ACCOUNTS = {
  ADMIN: 1,
  HR_MANAGER: 2,
  PAYROLL_USER: 3,
  PAYROLL_MANAGER: 4,
  EMPLOYEE: 5,
} as const
