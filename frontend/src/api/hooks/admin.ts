import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, type QueryValue } from '../client'
import { keys } from '../keys'
import { useApiMutation } from '../mutation'
import type {
  AdminUser, AuditEvent, CreateUserResult, Dashboard, Grant, MyDashboard, MyProfile,
  PermissionCatalogItem, RoleCode,
} from '../types'
import type { TableQuery } from '@/lib/hooks/useTableState'

/** Endpoint-specific filters, alongside the paging the table controller supplies. */
type Filters = Record<string, QueryValue>

/* ------------------------------------------------------------ dashboards */

export function useHrDashboard(filters: { period: string; departmentId?: number | null }, enabled: boolean) {
  return useQuery({
    queryKey: keys.dashboard.hr(filters),
    enabled,
    queryFn: () => api.get<Dashboard>('/api/reports/dashboard', filters),
    // A quiet minute-by-minute refresh. The old fifteen-second poll advertised itself with a badge
    // that told the reader nothing they could act on.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
}

export function useMyDashboard(enabled = true) {
  return useQuery({
    queryKey: keys.me.dashboard,
    enabled,
    queryFn: () => api.get<MyDashboard>('/api/reports/dashboard/me'),
  })
}

/* --------------------------------------------------------- self service */

export function useMyProfile() {
  return useQuery({ queryKey: keys.me.profile, queryFn: () => api.get<MyProfile>('/api/me/profile') })
}

export function useUpdateMyProfile(onDone?: () => void) {
  return useApiMutation<MyProfile, { displayName: string }>({
    mutationFn: (body) => api.put<MyProfile>('/api/me/profile', body),
    invalidate: [keys.me.all, keys.employees.all],
    success: 'Profile updated',
    errorTitle: 'Your profile could not be updated',
    onSuccess: () => onDone?.(),
  })
}

export function useUpdateMyBankAccount(onDone?: () => void) {
  return useApiMutation<unknown, { bankName: string; accountNumber: string; ifsc?: string; currentPassword: string }>({
    mutationFn: (body) => api.put('/api/me/bank-account', body),
    invalidate: [keys.me.all],
    success: 'Bank details updated. Your next payslip will use them.',
    errorTitle: 'Your bank details could not be updated',
    onSuccess: () => onDone?.(),
  })
}

export function useChangeMyPassword(onDone?: () => void) {
  return useApiMutation<void, { currentPassword: string; newPassword: string }>({
    mutationFn: (body) => api.post('/api/me/change-password', body),
    success: 'Password changed',
    errorTitle: 'Your password could not be changed',
    // Shown against the field it concerns, rather than in a corner of the screen.
    onError: () => true,
    onSuccess: () => onDone?.(),
  })
}

/* ------------------------------------------------------------- users */

export function useAdminUsers(params: TableQuery & Partial<Filters>) {
  return useQuery({
    queryKey: keys.admin.users(params),
    queryFn: () => api.page<AdminUser>('/api/admin/users', params),
    placeholderData: keepPreviousData,
  })
}

/** Users for the audit-log actor picker. */
export function useUserOptions(enabled = true) {
  return useQuery({
    queryKey: keys.admin.userOptions,
    enabled,
    staleTime: 300_000,
    queryFn: () => api.page<AdminUser>('/api/admin/users', { size: 200, sort: 'displayName,asc' }),
  })
}

export function useUserPermissions(id: number | null) {
  return useQuery({
    queryKey: keys.admin.userPermissions(id ?? 0),
    enabled: id !== null,
    queryFn: () =>
      api.get<{ effective: string[]; fromRole: string[]; grants: Grant[] }>(`/api/admin/users/${id}/permissions`),
  })
}

export function usePermissionCatalogue(enabled = true) {
  return useQuery({
    queryKey: keys.admin.permissionCatalogue,
    enabled,
    staleTime: 300_000,
    queryFn: () => api.get<PermissionCatalogItem[]>('/api/admin/permissions'),
  })
}

export function useUpdateUser(onDone?: () => void) {
  return useApiMutation<AdminUser, { id: number; body: Record<string, unknown> }>({
    mutationFn: ({ id, body }) => api.put<AdminUser>(`/api/admin/users/${id}`, body),
    invalidate: [keys.admin.all],
    success: 'User updated',
    errorTitle: 'The user could not be updated',
    onSuccess: () => onDone?.(),
  })
}

export function useAssignRole(onDone?: () => void) {
  return useApiMutation<AdminUser, { id: number; roleCode: RoleCode }>({
    mutationFn: ({ id, roleCode }) => api.post<AdminUser>(`/api/admin/users/${id}/role`, { roleCode }),
    invalidate: [keys.admin.all, keys.employees.all],
    success: 'Role changed. It applies the next time they sign in.',
    errorTitle: 'The role could not be changed',
    onSuccess: () => onDone?.(),
  })
}

export function useResendInvite() {
  return useApiMutation<CreateUserResult, number>({
    mutationFn: (id) => api.post<CreateUserResult>(`/api/admin/users/${id}/resend-invite`),
    invalidate: [keys.admin.all],
    success: (result) => result.inviteMessage ?? 'Invite re-sent',
    errorTitle: 'The invite could not be sent',
  })
}

export function useCreateGrant(onDone?: () => void) {
  return useApiMutation<Grant, { userId: number; body: Record<string, unknown> }>({
    mutationFn: ({ userId, body }) => api.post<Grant>(`/api/admin/users/${userId}/grants`, body),
    invalidate: [keys.admin.all],
    success: 'Permission granted',
    errorTitle: 'The permission could not be granted',
    onSuccess: () => onDone?.(),
  })
}

export function useRevokeGrant(onDone?: () => void) {
  return useApiMutation<void, number>({
    mutationFn: (grantId) => api.del(`/api/admin/grants/${grantId}`),
    invalidate: [keys.admin.all],
    success: 'Permission revoked',
    errorTitle: 'The permission could not be revoked',
    onSuccess: () => onDone?.(),
  })
}

/* ------------------------------------------------------------- audit */

export function useAuditEvents(params: TableQuery & Partial<Filters>) {
  return useQuery({
    queryKey: keys.admin.audit(params),
    queryFn: () => api.page<AuditEvent>('/api/admin/audit', params),
    placeholderData: keepPreviousData,
  })
}

/** Totals for the chips above the table, matching whatever filter is on screen. */
export function useAuditSummary(filters: Filters) {
  return useQuery({
    queryKey: keys.admin.auditSummary(filters),
    queryFn: () => api.get<{ events: number; denied: number }>('/api/admin/audit/summary', filters),
  })
}
