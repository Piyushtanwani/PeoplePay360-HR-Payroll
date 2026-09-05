import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderPage } from '@/test/render'
import type { MyDashboard } from '@/api/types'

const dashboard: { data: MyDashboard | undefined; isLoading: boolean } = { data: undefined, isLoading: false }

vi.mock('@/api/hooks', () => ({
  useMyDashboard: () => dashboard,
  useAttendanceToday: () => ({ data: { openAttendance: null, todayRows: [] }, isLoading: false }),
  useCheckInOut: () => ({ mutate: vi.fn(), isPending: false }),
}))

import { EmployeeDashboard } from './EmployeeDashboard'

function data(over: Partial<MyDashboard> = {}): MyDashboard {
  return {
    displayName: 'Ana Silva', employeeNo: 'EMP001', jobTitle: 'Engineer', departmentName: 'Engineering',
    openAttendance: null, todayAttendance: [], attendanceDaysThisMonth: 18, exceptionsThisMonth: 2,
    leaveBalances: [
      { typeId: 1, typeName: 'Annual leave', allocated: 20, taken: 6, pending: 1, remaining: 13, unit: 'DAY' },
    ],
    pendingRequests: [],
    recentPayslips: [
      { id: 7, periodStart: '2026-08-01', periodEnd: '2026-08-31', net: 48250, payrunState: 'PAID' },
    ],
    upcomingHolidays: [{ id: 1, date: '2026-10-02', name: 'Gandhi Jayanti', recurring: false }],
    contract: {
      id: 3, reference: 'CTR-0003', jobTitle: 'Engineer', wageType: 'MONTHLY',
      startDate: '2024-01-15', endDate: null, state: 'RUNNING', scheduleName: 'Standard week',
    },
    ...over,
  } as MyDashboard
}

describe('EmployeeDashboard', () => {
  // The requirement: an employee gets a home of their own, not a redirect to attendance.
  it('greets the person and shows their own figures', () => {
    dashboard.data = data()
    renderPage(<EmployeeDashboard />, { path: '/' })
    expect(screen.getByText('Hello, Ana')).toBeInTheDocument()
    expect(screen.getByText('Days worked this month')).toBeInTheDocument()
    expect(screen.getByText('Days needing attention')).toBeInTheDocument()
  })

  it('shows leave balances, recent payslips, the contract and what is coming up', () => {
    dashboard.data = data()
    renderPage(<EmployeeDashboard />, { path: '/' })
    expect(screen.getByText('Annual leave')).toBeInTheDocument()
    expect(screen.getByText('Recent payslips')).toBeInTheDocument()
    expect(screen.getByText('Your contract')).toBeInTheDocument()
    expect(screen.getByText('Gandhi Jayanti')).toBeInTheDocument()
  })

  it('carries none of the company-wide payroll figures an employee may not see', () => {
    dashboard.data = data()
    renderPage(<EmployeeDashboard />, { path: '/' })
    expect(screen.queryByText(/Headcount/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Total payroll cost/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Pending approvals/i)).not.toBeInTheDocument()
  })

  it('says a holiday is not deducted from leave, rather than leaving it to be guessed', () => {
    dashboard.data = data()
    renderPage(<EmployeeDashboard />, { path: '/' })
    expect(screen.getByText(/not deducted from your leave/)).toBeInTheDocument()
  })

  it('names the gap when somebody has no contract in force', () => {
    dashboard.data = data({ contract: null })
    renderPage(<EmployeeDashboard />, { path: '/' })
    expect(screen.getByText('No contract in force')).toBeInTheDocument()
  })

  it('explains an empty dashboard instead of showing a blank page', () => {
    dashboard.data = undefined
    renderPage(<EmployeeDashboard />, { path: '/' })
    expect(screen.getByText('Nothing to show yet')).toBeInTheDocument()
  })
})
