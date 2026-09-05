import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderPage } from '@/test/render'
import { ApiError } from '@/api/client'
import type { AttendanceException } from '@/api/types'

const resolve = { mutate: vi.fn(), isPending: false, isError: false, error: null as unknown }
vi.mock('@/api/hooks', () => ({ useResolveException: () => resolve }))

import { ResolveSheet } from './ResolveSheet'

function exception(over: Partial<AttendanceException> = {}): AttendanceException {
  return {
    id: 11, employeeId: 5, employeeName: 'Ana Silva', date: '2026-09-01',
    type: 'MISSING_CHECKOUT', minutes: 0, resolved: false, attendanceId: 91,
    scheduledEnd: '17:00:00', resolvedBy: null, resolvedAt: null, resolutionNote: null,
    ...over,
  } as AttendanceException
}

beforeEach(() => {
  resolve.mutate.mockClear()
  resolve.isError = false
  resolve.error = null
})

describe('ResolveSheet', () => {
  it('will not resolve without a reason', () => {
    renderPage(<ResolveSheet exception={exception()} onOpenChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeDisabled()
  })

  // The defect this fixes: a bare "17:30" went to a field typed as an instant, the request
  // returned 400, and nothing appeared on screen.
  it('sends a full instant built from the exception date, not a bare clock time', async () => {
    const user = userEvent.setup()
    renderPage(<ResolveSheet exception={exception()} onOpenChange={() => {}} />)
    await user.type(screen.getByLabelText(/Reason/), 'Confirmed with their manager.')
    await user.click(screen.getByRole('button', { name: 'Resolve' }))

    expect(resolve.mutate).toHaveBeenCalledTimes(1)
    const sent = resolve.mutate.mock.calls[0][0]
    expect(sent.id).toBe(11)
    expect(sent.reason).toBe('Confirmed with their manager.')
    expect(sent.checkOut).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)

    const stamp = new Date(sent.checkOut)
    expect(stamp.getFullYear()).toBe(2026)
    expect(stamp.getMonth()).toBe(8)
    expect(stamp.getDate()).toBe(1)
    expect(stamp.getHours()).toBe(17)
  })

  it('offers the employee’s own scheduled finish rather than a fixed half past five', () => {
    renderPage(<ResolveSheet exception={exception({ scheduledEnd: '18:30:00' })} onOpenChange={() => {}} />)
    expect(screen.getByText('Scheduled finish (18:30)')).toBeInTheDocument()
  })

  it('sends no time when the entry is left open', async () => {
    const user = userEvent.setup()
    renderPage(<ResolveSheet exception={exception({ attendanceId: null, type: 'ABSENT' })} onOpenChange={() => {}} />)
    await user.type(screen.getByLabelText(/Reason/), 'Approved leave applied afterwards.')
    await user.click(screen.getByRole('button', { name: 'Resolve' }))
    expect(resolve.mutate.mock.calls[0][0].checkOut).toBeUndefined()
  })

  it('explains why an exception with no times has none to correct', () => {
    renderPage(<ResolveSheet exception={exception({ attendanceId: null, type: 'ABSENT' })} onOpenChange={() => {}} />)
    expect(screen.getByText(/has no times to correct/)).toBeInTheDocument()
    expect(screen.queryByText(/Scheduled finish \(/)).not.toBeInTheDocument()
  })

  it('says the resolution is recorded against the person doing it', () => {
    renderPage(<ResolveSheet exception={exception()} onOpenChange={() => {}} />)
    expect(screen.getByText(/Recorded against your name/)).toBeInTheDocument()
  })

  // A failure used to be swallowed entirely, which is how the broken action stayed invisible.
  it('shows the server’s refusal instead of failing silently', () => {
    resolve.isError = true
    resolve.error = new ApiError({ status: 400, code: 'VALIDATION', detail: 'Check-out cannot precede check-in.' })
    renderPage(<ResolveSheet exception={exception()} onOpenChange={() => {}} />)
    expect(screen.getByText('Not resolved')).toBeInTheDocument()
    expect(screen.getByText('Check-out cannot precede check-in.')).toBeInTheDocument()
  })
})
