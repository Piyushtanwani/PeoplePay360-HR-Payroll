import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockAuth, pageOf, renderPage } from '@/test/render'
import type { AuditEvent } from '@/api/types'

const captured: { events?: Record<string, unknown> } = {}

const EVENTS: AuditEvent[] = [
  {
    id: 1, occurredAt: '2026-09-05T09:15:00Z', actorUserId: 1, actorName: 'Ana Silva',
    actorRoles: ['HR_MANAGER'], channel: 'UI', action: 'EMPLOYEE_UPDATE', resourceType: 'employee',
    resourceId: '5', outcome: 'ALLOW', reason: 'Corrected job title', beforeJson: '{"jobTitle":"Engineer"}',
    afterJson: '{"jobTitle":"Senior Engineer"}', requestId: 'req-1',
  },
  {
    id: 2, occurredAt: '2026-09-05T08:00:00Z', actorUserId: 2, actorName: 'Ben Okoro',
    actorRoles: ['EMPLOYEE'], channel: 'CHAT', action: 'PAYRUN_READ', resourceType: 'payrun',
    resourceId: '3', outcome: 'DENY', reason: 'payrun.read', beforeJson: null, afterJson: null,
    requestId: 'req-2',
  },
]

vi.mock('@/api/hooks', () => ({
  useAuditEvents: (filters: Record<string, unknown>) => {
    captured.events = filters
    return { data: pageOf(EVENTS, 128), isLoading: false, isFetching: false, error: null, refetch: vi.fn() }
  },
  useAuditSummary: () => ({ data: { events: 128, denied: 4 }, isLoading: false }),
  useUserOptions: () => ({ data: [], isLoading: false }),
}))

const auth = mockAuth('ADMIN')
vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => auth }))

import { AuditPage } from './AuditPage'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 6, 12, 0))
})
afterEach(() => vi.useRealTimers())

describe('AuditPage', () => {
  // The requirement: the page has a purpose, which starts with not being an unbounded dump.
  it('opens on the last seven days rather than all of history', () => {
    renderPage(<AuditPage />, { path: '/admin/audit' })
    expect(captured.events?.from).toBe('2026-08-30T00:00:00Z')
    expect(captured.events?.to).toBe('2026-09-06T23:59:59Z')
  })

  it('shows the newest event first', () => {
    renderPage(<AuditPage />, { path: '/admin/audit' })
    expect(captured.events?.sort).toBe('occurredAt,desc')
  })

  it('leads with how many events and how many refusals are in the range', () => {
    renderPage(<AuditPage />, { path: '/admin/audit' })
    expect(screen.getByText('Events in this range')).toBeInTheDocument()
    expect(screen.getByText('Refused')).toBeInTheDocument()
    expect(screen.getByText('Actions somebody attempted without permission')).toBeInTheDocument()
  })

  it('says what the log is for, in the header', () => {
    renderPage(<AuditPage />, { path: '/admin/audit' })
    expect(screen.getByText(/Who changed what, who was refused/)).toBeInTheDocument()
  })

  it('answers who did what to which record', () => {
    renderPage(<AuditPage />, { path: '/admin/audit' })
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.getByText('Employee update')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Employee 5' })).toHaveAttribute('href', expect.stringContaining('5'))
  })

  it('marks a refusal differently from a permitted action', () => {
    renderPage(<AuditPage />, { path: '/admin/audit' })
    expect(screen.getByText('Deny')).toBeInTheDocument()
    expect(screen.getByText('Allow')).toBeInTheDocument()
  })

  it('pages the log', () => {
    renderPage(<AuditPage />, { path: '/admin/audit' })
    expect(screen.getByText(/Showing 1–2 of 128/)).toBeInTheDocument()
  })

  it('honours a range given in the address bar, so a link to an incident reopens it', () => {
    renderPage(<AuditPage />, { path: '/admin/audit?from=2026-01-01&to=2026-01-31' })
    expect(captured.events?.from).toBe('2026-01-01T00:00:00Z')
    expect(captured.events?.to).toBe('2026-01-31T23:59:59Z')
  })
})
