import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureClient } from '@/api/client'
import { ACCOUNTS, server, tokenFor } from '@/test/server'
import { mockAuth, renderPage } from '@/test/render'
import * as db from '@/test/msw/data/seed'

/**
 * The employees list, end to end against the seeded dataset.
 *
 * Nothing is stubbed below the page: the real query hooks call the real client, which reaches the
 * mock backend and gets a real page envelope back. That is what proves paging, sorting and search
 * are actually wired, rather than merely rendered.
 */

let auth = mockAuth('ADMIN')
vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => auth }))

import { EmployeesPage } from './EmployeesPage'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

beforeEach(() => {
  auth = mockAuth('ADMIN')
  configureClient({ getToken: () => tokenFor(ACCOUNTS.ADMIN), onUnauthenticated: () => {} })
  localStorage.setItem('pp360.employees.view', 'list')
})

/** The first page of names the server would return for the default sort. */
function expectedFirstPage(size = 20) {
  return db.employees
    .filter((e) => e.active)
    .map((e) => e.displayName)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, size)
}

describe('EmployeesPage against the seeded data', () => {
  it('asks for twenty rows and says how many there are in total', async () => {
    renderPage(<EmployeesPage />, { path: '/employees' })
    const activeCount = db.employees.filter((e) => e.active).length
    await waitFor(() =>
      expect(screen.getByText(new RegExp(`Showing 1–\\d+ of ${activeCount}`))).toBeInTheDocument(),
    )
    expect(screen.getByText(expectedFirstPage()[0])).toBeInTheDocument()
  })

  it('sorts by name by default, and the server honours it', async () => {
    renderPage(<EmployeesPage />, { path: '/employees' })
    await waitFor(() => expect(screen.getByText(expectedFirstPage()[0])).toBeInTheDocument())

    // The first cell carries an avatar and an employee number alongside the name, so the assertion
    // is that each row holds the name the server would have placed there, in that order.
    const rows = screen.getAllByRole('row').slice(1)
    const expected = expectedFirstPage(rows.length)
    rows.forEach((row, index) => {
      expect(within(row).getAllByRole('cell')[0]).toHaveTextContent(expected[index])
    })
  })

  it('moves to the next page rather than showing everything at once', async () => {
    const user = userEvent.setup()
    const activeCount = db.employees.filter((e) => e.active).length
    if (activeCount <= 20) return

    renderPage(<EmployeesPage />, { path: '/employees' })
    await waitFor(() => expect(screen.getByText(/Showing 1–/)).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(screen.getByText(/Showing 21–/)).toBeInTheDocument())
  })

  it('narrows the list from the search box', async () => {
    const user = userEvent.setup()
    const target = db.employees.find((e) => e.active)!
    renderPage(<EmployeesPage />, { path: '/employees' })
    await waitFor(() => expect(screen.getByText(/Showing 1–/)).toBeInTheDocument())

    await user.type(screen.getByRole('searchbox'), target.displayName.split(' ')[0])
    await waitFor(() => expect(screen.getByText(target.displayName)).toBeInTheDocument())
    await waitFor(() => {
      const shown = screen.getAllByRole('row').length - 1
      expect(shown).toBeLessThan(db.employees.filter((e) => e.active).length)
    })
  })

  it('honours a department deep link from the departments page', async () => {
    const departmentId = db.employees[0].departmentId
    const inDepartment = db.employees.filter((e) => e.active && e.departmentId === departmentId).length
    renderPage(<EmployeesPage />, { path: `/employees?departmentId=${departmentId}` })
    await waitFor(() => expect(screen.getByText(new RegExp(`of ${inDepartment}`))).toBeInTheDocument())
  })

  // The RBAC boundary: an employee holds `employee.read.own`, and the list endpoint needs `.all`.
  it('refuses the list to somebody who may only read their own record', async () => {
    auth = mockAuth('EMPLOYEE')
    configureClient({ getToken: () => tokenFor(ACCOUNTS.EMPLOYEE), onUnauthenticated: () => {} })
    renderPage(<EmployeesPage />, { path: '/employees' })
    await waitFor(() =>
      expect(screen.getByText(/do not have permission/i)).toBeInTheDocument(),
    )
  })
})
