import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockAuth, pageOf, renderPage } from '@/test/render'
import type { AdminUser } from '@/api/types'

const USERS: AdminUser[] = [
  {
    id: 1, email: 'ana@peoplepay.local', displayName: 'Ana Silva', roleCode: 'HR_MANAGER',
    employeeId: 5, active: true, employeeName: 'Ana Silva', grantCount: 0,
    passwordSetAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 2, email: 'ben@peoplepay.local', displayName: 'Ben Okoro', roleCode: 'EMPLOYEE',
    employeeId: 6, active: false, employeeName: 'Ben Okoro', grantCount: 2, passwordSetAt: null,
  },
]

const idle = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isError: false, error: null, data: undefined }

vi.mock('@/api/hooks', () => ({
  useAdminUsers: () => ({ data: pageOf(USERS, 43), isLoading: false, isFetching: false, error: null, refetch: vi.fn() }),
  useAssignRole: () => idle,
  useAuditEvents: () => ({ data: pageOf([]), isLoading: false, isFetching: false, error: null }),
  useCreateGrant: () => idle,
  usePermissionCatalogue: () => ({ data: [], isLoading: false }),
  useResendInvite: () => idle,
  useRevokeGrant: () => idle,
  useUpdateUser: () => idle,
  useUserPermissions: () => ({ data: null, isLoading: false }),
}))

const auth = mockAuth('ADMIN')
vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => auth }))

import { UsersPage } from './UsersPage'

describe('UsersPage', () => {
  // The requirement: this page no longer creates logins, so it must not ask for an email or a role.
  it('has no form for creating a login', () => {
    const { container } = renderPage(<UsersPage />, { path: '/admin/users' })
    expect(screen.queryByRole('button', { name: /new user|create user|add user|invite/i })).not.toBeInTheDocument()
    // No address to type: the email comes from the employee record, and the role is chosen there too.
    expect(container.querySelector('input[type="email"]')).toBeNull()
    expect(screen.queryByLabelText(/^email( address)?$/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^role$/i)).not.toBeInTheDocument()
  })

  it('says where logins are created instead of leaving it a mystery', () => {
    renderPage(<UsersPage />, { path: '/admin/users' })
    expect(screen.getByText(/Employees page/)).toBeInTheDocument()
    expect(screen.getByText(/choose a role there/)).toBeInTheDocument()
  })

  it('lists people with their role and whether they can sign in', () => {
    renderPage(<UsersPage />, { path: '/admin/users' })
    expect(screen.getAllByText('Ana Silva').length).toBeGreaterThan(0)
    expect(screen.getByText('ben@peoplepay.local')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Role/ })).toBeInTheDocument()
  })

  it('pages the list rather than showing whatever fits', () => {
    renderPage(<UsersPage />, { path: '/admin/users' })
    expect(screen.getByText(/Showing 1–2 of 43/)).toBeInTheDocument()
  })

  it('offers a search and a role filter', () => {
    renderPage(<UsersPage />, { path: '/admin/users' })
    expect(screen.getByRole('searchbox', { name: /Search name or email/ })).toBeInTheDocument()
    expect(screen.getByText('All roles')).toBeInTheDocument()
  })

  // The requirement: a login whose invite has never been redeemed must be discoverable from the
  // list itself, not only after opening the row.
  it('flags a login that has not set a password yet, directly in the list', () => {
    renderPage(<UsersPage />, { path: '/admin/users' })
    expect(screen.getByText('Invite pending')).toBeInTheDocument()
    expect(screen.getByText('Signed up')).toBeInTheDocument()
  })
})
