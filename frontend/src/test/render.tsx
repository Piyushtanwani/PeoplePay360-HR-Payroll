import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderResult } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import { ToastProvider, TooltipProvider } from '@/components/ui'
import type { EmployeeSummary, MeResponse, RoleCode, UserSummary } from '@/api/types'

/**
 * Rendering a page the way the application does, minus the network.
 *
 * Page tests exist to prove behaviour a person would notice: that a form has no role field, that a
 * table paginates, that a banner appears when a figure goes negative. They should fail for those
 * reasons and no others, so the session and the server are both supplied as fixtures.
 */

/** The permissions each role actually holds, taken from the seeded catalogue. */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [
    'user.read', 'user.create', 'user.update', 'role.assign', 'audit.read', 'ai.settings',
    'employee.read.all', 'employee.create', 'employee.update', 'department.read', 'department.manage',
    'contract.read.all', 'contract.manage', 'schedule.read', 'schedule.manage',
    'attendance.read.all', 'attendance.manage', 'timeoff_request.read.all', 'timeoff_request.approve',
    'timeoff_type.manage', 'payrun.read', 'payrun.manage', 'payrun.export', 'payslip.read.all',
    'salary_structure.read', 'salary_structure.manage', 'salary_structure.dry_run', 'dashboard.read.hr',
  ],
  PAYROLL_MANAGER: [
    'employee.read.all', 'contract.read.all', 'payrun.read', 'payrun.manage', 'payrun.export',
    'payslip.read.all', 'salary_structure.read', 'salary_structure.manage', 'salary_structure.dry_run',
    'dashboard.read.hr', 'attendance.read.all',
  ],
  PAYROLL_USER: ['employee.read.all', 'payrun.read', 'payslip.read.all', 'salary_structure.read', 'dashboard.read.hr'],
  HR_MANAGER: [
    'employee.read.all', 'employee.create', 'employee.update', 'department.read', 'department.manage',
    'contract.read.all', 'contract.manage', 'schedule.read', 'schedule.manage', 'attendance.read.all',
    'attendance.manage', 'timeoff_request.read.all', 'timeoff_request.approve', 'timeoff_type.manage',
    'dashboard.read.hr', 'user.create', 'user.update', 'role.assign',
  ],
  EMPLOYEE: ['employee.read.own', 'attendance.read.own', 'timeoff_request.read.own', 'payslip.read.own'],
}

export function meFixture(role = 'ADMIN', overrides: Partial<MeResponse> = {}): MeResponse {
  return {
    user: {
      id: 1,
      email: 'test@peoplepay.local',
      displayName: 'Test User',
      roleCode: role as RoleCode,
      employeeId: 5,
      active: true,
    } satisfies UserSummary,
    permissions: ROLE_PERMISSIONS[role] ?? [],
    employee: {
      id: 5,
      employeeNo: 'EMP005',
      displayName: 'Test User',
      jobTitle: 'Engineer',
      departmentId: 1,
      departmentName: 'Engineering',
      employeeType: 'FULL_TIME',
      managerId: null,
      managerName: null,
      active: true,
      avatarColor: '#4f46e5',
    } satisfies EmployeeSummary,
    settings: { currency: 'INR', timezone: 'Asia/Kolkata', appName: 'PeoplePay360', profile: 'demo' },
    features: { chat: true, recruitment: false },
    ...overrides,
  }
}

/** A page of rows in the envelope every list endpoint returns. */
export function pageOf<T>(content: T[], total = content.length, page = 0, size = 20) {
  return { content, page, size, totalElements: total, totalPages: Math.max(1, Math.ceil(total / size)) }
}

export interface RenderOptions {
  role?: string
  /** Extra permissions on top of the role, for a case that needs one specific grant. */
  permissions?: string[]
  path?: string
  /** The route pattern, when the page reads an id out of the address. */
  route?: string
}

export function renderPage(ui: React.ReactElement, options: RenderOptions = {}): RenderResult {
  const { path = '/', route } = options
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 }, mutations: { retry: false } },
  })
  return render(
    // The same providers the application root supplies, so a page under test behaves as it ships.
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>
            {route ? <Routes><Route path={route} element={ui} /></Routes> : ui}
          </MemoryRouter>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

/**
 * The signed-in session, as a module mock.
 *
 * Call at the top of a test file, outside any hook, because vi.mock is hoisted.
 */
export function mockAuth(role = 'ADMIN', extra: string[] = []) {
  const permissions = new Set([...(ROLE_PERMISSIONS[role] ?? []), ...extra])
  const me = meFixture(role)
  return {
    token: 'test-token',
    me,
    loading: false,
    expired: false,
    sessionError: null,
    retry: vi.fn(),
    permissions,
    can: (code: string) => permissions.has(code),
    canAny: (codes: string[]) => codes.some((c) => permissions.has(c)),
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    user: me.user,
    employeeId: 5,
  }
}
