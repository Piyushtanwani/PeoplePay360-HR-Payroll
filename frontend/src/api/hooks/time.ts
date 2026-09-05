import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, type QueryValue } from '../client'
import { keys } from '../keys'
import { useApiMutation } from '../mutation'
import type {
  Attendance, AttendanceException, AttendanceRules, Holiday, LeaveBalance,
  TimeOffAllocation, TimeOffRequest, TimeOffType,
} from '../types'
import type { TableQuery } from '@/lib/hooks/useTableState'

/** Endpoint-specific filters, alongside the paging the table controller supplies. */
type Filters = Record<string, QueryValue>

/* ----------------------------------------------------------- attendance */

export function useAttendance(params: TableQuery & Partial<Filters>, enabled = true) {
  return useQuery({
    queryKey: keys.attendance.list(params),
    enabled,
    queryFn: () => api.page<Attendance>('/api/attendance', params),
    placeholderData: keepPreviousData,
  })
}

export function useAttendanceExceptions(params: TableQuery & Partial<Filters>, enabled = true) {
  return useQuery({
    queryKey: keys.attendance.exceptions(params),
    enabled,
    queryFn: () => api.page<AttendanceException>('/api/attendance/exceptions', params),
    placeholderData: keepPreviousData,
  })
}

export function useAttendanceToday(enabled = true) {
  return useQuery({
    queryKey: keys.attendance.today,
    enabled,
    queryFn: () => api.get<{ openAttendance: Attendance | null; todayRows: Attendance[] }>('/api/attendance/today'),
  })
}

/** The classification rules, for the help panel. They change only with configuration, so cache them. */
export function useAttendanceRules(enabled = true) {
  return useQuery({
    queryKey: keys.attendance.rules,
    enabled,
    staleTime: 3_600_000,
    queryFn: () => api.get<AttendanceRules>('/api/attendance/rules'),
  })
}

export function useCheckInOut() {
  return useApiMutation<Attendance, 'check-in' | 'check-out'>({
    mutationFn: (action) => api.post<Attendance>(`/api/attendance/${action}`),
    invalidate: [keys.attendance.all, keys.me.dashboard],
    success: (_data, action) => (action === 'check-in' ? 'Checked in' : 'Checked out'),
    errorTitle: 'That did not work',
  })
}

export function useCorrectAttendance(onDone?: () => void) {
  return useApiMutation<Attendance, { id: number; checkIn?: string; checkOut?: string; editReason: string }>({
    mutationFn: ({ id, ...body }) => api.put<Attendance>(`/api/attendance/${id}`, body),
    invalidate: [keys.attendance.all],
    success: 'Attendance corrected. The original times are kept on the record.',
    errorTitle: 'The correction could not be saved',
    onSuccess: () => onDone?.(),
  })
}

export function useResolveException(onDone?: () => void) {
  return useApiMutation<AttendanceException, { id: number; checkOut?: string; reason: string }>({
    mutationFn: ({ id, ...body }) =>
      api.post<AttendanceException>(`/api/attendance/exceptions/${id}/resolve`, body),
    invalidate: [keys.attendance.all, keys.dashboard.all],
    success: 'Exception resolved',
    errorTitle: 'The exception could not be resolved',
    onSuccess: () => onDone?.(),
  })
}

export function useRecomputeAttendance() {
  return useApiMutation<void, string>({
    mutationFn: (period) => api.post(`/api/attendance/recompute`, undefined, { period }),
    invalidate: [keys.attendance.all, keys.dashboard.all],
    success: 'Period recomputed from the recorded times',
    errorTitle: 'The period could not be recomputed',
  })
}

/* -------------------------------------------------------------- time off */

export function useTimeOffTypes() {
  return useQuery({
    queryKey: keys.timeoff.types,
    queryFn: () => api.get<TimeOffType[]>('/api/timeoff/types'),
    staleTime: 300_000,
  })
}

export function useSaveTimeOffType(onDone?: () => void) {
  return useApiMutation<TimeOffType, { id: number | null; body: Record<string, unknown> }>({
    mutationFn: ({ id, body }) =>
      id ? api.put<TimeOffType>(`/api/timeoff/types/${id}`, body) : api.post<TimeOffType>('/api/timeoff/types', body),
    invalidate: [keys.timeoff.all],
    success: 'Leave type saved',
    errorTitle: 'The leave type could not be saved',
    onSuccess: () => onDone?.(),
  })
}

export function useLeaveBalances(employeeId: number | null, enabled = true) {
  return useQuery({
    queryKey: keys.timeoff.balances(employeeId ?? 'me'),
    enabled,
    queryFn: () =>
      api.get<LeaveBalance[]>('/api/timeoff/balances', employeeId ? { employeeId } : undefined),
  })
}

export function useTimeOffRequests(params: TableQuery & Partial<Filters>, enabled = true) {
  return useQuery({
    queryKey: keys.timeoff.requests(params),
    enabled,
    queryFn: () => api.page<TimeOffRequest>('/api/timeoff/requests', params),
    placeholderData: keepPreviousData,
  })
}

export function useTimeOffAllocations(params: TableQuery & Partial<Filters>, enabled = true) {
  return useQuery({
    queryKey: keys.timeoff.allocations(params),
    enabled,
    queryFn: () => api.page<TimeOffAllocation>('/api/timeoff/allocations', params),
    placeholderData: keepPreviousData,
  })
}

/**
 * The live balance check on the request form.
 *
 * This is a POST, so it is a mutation the form triggers rather than a query React Query might refetch
 * on its own. The previous version declared it as a query and re-fired on remount.
 */
export function useSimulateLeave() {
  return useApiMutation<
    { days: number; available: number; projectedAfter: number; anomaly: string | null },
    { typeId: number; startDate: string; endDate: string; employeeId?: number | null }
  >({
    mutationFn: (body) => api.post('/api/timeoff/requests/simulate', body),
    errorTitle: 'The balance check failed',
    // Shown inline beside the dates rather than as a toast, since it is guidance, not a failure.
    onError: () => true,
  })
}

export function useCreateRequest(onDone?: () => void) {
  return useApiMutation<TimeOffRequest, Record<string, unknown>>({
    mutationFn: (body) => api.post<TimeOffRequest>('/api/timeoff/requests', body),
    invalidate: [keys.timeoff.all, keys.me.dashboard, keys.dashboard.all],
    success: (request) =>
      request.state === 'NEEDS_ATTENTION'
        ? 'Request submitted, but it needs attention. Open it to see why.'
        : 'Request submitted',
    errorTitle: 'The request could not be submitted',
    onSuccess: () => onDone?.(),
  })
}

export function useDecideRequest() {
  return useApiMutation<TimeOffRequest, { id: number; action: 'approve' | 'refuse' | 'cancel'; note?: string }>({
    mutationFn: ({ id, action, note }) =>
      api.post<TimeOffRequest>(`/api/timeoff/requests/${id}/${action}`, note ? { note } : undefined),
    invalidate: [keys.timeoff.all, keys.me.dashboard, keys.dashboard.all],
    success: (_data, vars) =>
      vars.action === 'approve' ? 'Request approved' : vars.action === 'refuse' ? 'Request refused' : 'Request cancelled',
    errorTitle: 'The request could not be updated',
  })
}

export function useCreateAllocation(onDone?: () => void) {
  return useApiMutation<TimeOffAllocation, Record<string, unknown>>({
    mutationFn: (body) => api.post<TimeOffAllocation>('/api/timeoff/allocations', body),
    invalidate: [keys.timeoff.all],
    success: 'Allocation created as a draft. Approve it to grant the balance.',
    errorTitle: 'The allocation could not be created',
    onSuccess: () => onDone?.(),
  })
}

export function useDecideAllocation() {
  return useApiMutation<TimeOffAllocation, { id: number; action: 'approve' | 'refuse' }>({
    mutationFn: ({ id, action }) => api.post<TimeOffAllocation>(`/api/timeoff/allocations/${id}/${action}`),
    invalidate: [keys.timeoff.all],
    success: (_data, vars) =>
      vars.action === 'approve' ? 'Allocation approved. The balance is now available.' : 'Allocation refused',
    errorTitle: 'The allocation could not be updated',
  })
}

/* -------------------------------------------------------------- holidays */

export function useHolidays(year: number) {
  return useQuery({
    queryKey: keys.timeoff.holidays(year),
    queryFn: () => api.get<Holiday[]>('/api/timeoff/holidays', { year }),
  })
}

export function useCreateHoliday(onDone?: () => void) {
  return useApiMutation<Holiday, { date: string; name: string }>({
    mutationFn: (body) => api.post<Holiday>('/api/timeoff/holidays', body),
    invalidate: [keys.timeoff.all, keys.attendance.all],
    success: 'Holiday added. It is now excluded from scheduled days.',
    errorTitle: 'The holiday could not be added',
    onSuccess: () => onDone?.(),
  })
}

export function useDeleteHoliday(onDone?: () => void) {
  return useApiMutation<void, number>({
    mutationFn: (id) => api.del(`/api/timeoff/holidays/${id}`),
    invalidate: [keys.timeoff.all, keys.attendance.all],
    success: 'Holiday removed',
    errorTitle: 'The holiday could not be removed',
    onSuccess: () => onDone?.(),
  })
}
