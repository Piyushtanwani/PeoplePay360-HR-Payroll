import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, type QueryValue, type Page } from '../client'
import { keys } from '../keys'
import { useApiMutation } from '../mutation'
import type {
  Contract, ContractTemplate, Department, Employee, EmployeeSummary, SaveEmployee, ScheduleName, WorkingSchedule,
} from '../types'
import type { TableQuery } from '@/lib/hooks/useTableState'

/** Endpoint-specific filters, alongside the paging the table controller supplies. */
type Filters = Record<string, QueryValue>

/* ------------------------------------------------------------ employees */

export function useEmployees(params: TableQuery & Partial<Filters>) {
  return useQuery({
    queryKey: keys.employees.list(params),
    queryFn: () => api.page<EmployeeSummary>('/api/employees', params),
    // Keeps the previous page on screen while the next one loads, so paging does not flash a skeleton.
    placeholderData: keepPreviousData,
  })
}

/** Everyone, for a picker. Capped, and sorted by name so the list is scannable. */
export function useEmployeeOptions(enabled = true) {
  return useQuery({
    queryKey: keys.employees.options,
    enabled,
    staleTime: 120_000,
    queryFn: () => api.page<EmployeeSummary>('/api/employees', { size: 200, sort: 'displayName,asc', active: true }),
  })
}

export function useEmployee(id: number | null) {
  return useQuery({
    queryKey: keys.employees.detail(id ?? 0),
    enabled: id !== null,
    queryFn: () => api.get<Employee>(`/api/employees/${id}`),
  })
}

export function useCreateEmployee(onDone?: (employee: Employee) => void) {
  return useApiMutation<Employee, SaveEmployee>({
    mutationFn: (body) => api.post<Employee>('/api/employees', body),
    invalidate: [keys.employees.all, keys.contracts.all, keys.admin.all],
    // The confirmation says what else was created, because the form quietly does two more things.
    success: (employee) => {
      const parts = [`${employee.displayName} added`]
      if (employee.onboarding?.contractReference) parts.push(`contract ${employee.onboarding.contractReference}`)
      if (employee.onboarding?.userId) {
        parts.push(employee.onboarding.inviteSent ? 'invite emailed' : 'login created, invite not sent')
      }
      return parts.join(' · ')
    },
    errorTitle: 'The employee could not be created',
    onSuccess: (employee) => onDone?.(employee),
  })
}

export function useUpdateEmployee(onDone?: () => void) {
  return useApiMutation<Employee, { id: number; body: SaveEmployee }>({
    mutationFn: ({ id, body }) => api.put<Employee>(`/api/employees/${id}`, body),
    invalidate: [keys.employees.all, keys.admin.all],
    success: 'Employee updated',
    errorTitle: 'The employee could not be updated',
    onSuccess: () => onDone?.(),
  })
}

export function useCreateLogin(onDone?: () => void) {
  return useApiMutation<Employee, { id: number; roleCode: string }>({
    mutationFn: ({ id, roleCode }) => api.post<Employee>(`/api/employees/${id}/login`, { roleCode }),
    invalidate: [keys.employees.all, keys.admin.all],
    success: (employee) =>
      employee.onboarding?.inviteSent ? 'Login created and invite emailed' : 'Login created, but the invite could not be sent',
    errorTitle: 'The login could not be created',
    onSuccess: () => onDone?.(),
  })
}

export function useSetBankAccount(onDone?: () => void) {
  return useApiMutation<void, { id: number; bankName: string; accountNumber: string; ifsc?: string }>({
    mutationFn: ({ id, ...body }) => api.put(`/api/employees/${id}/bank-account`, body),
    invalidate: [keys.employees.all],
    success: 'Bank details saved',
    errorTitle: 'The bank details could not be saved',
    onSuccess: () => onDone?.(),
  })
}

/* ---------------------------------------------------------- departments */

export function useDepartments() {
  return useQuery({
    queryKey: keys.departments.all,
    queryFn: () => api.get<Department[]>('/api/departments'),
    staleTime: 300_000,
  })
}

export function useSaveDepartment(onDone?: () => void) {
  return useApiMutation<Department, { id: number | null; name: string }>({
    mutationFn: ({ id, name }) =>
      id ? api.put<Department>(`/api/departments/${id}`, { name }) : api.post<Department>('/api/departments', { name }),
    invalidate: [keys.departments.all, keys.employees.all],
    success: 'Department saved',
    errorTitle: 'The department could not be saved',
    onSuccess: () => onDone?.(),
  })
}

export function useDeleteDepartment(onDone?: () => void) {
  return useApiMutation<void, number>({
    mutationFn: (id) => api.del(`/api/departments/${id}`),
    invalidate: [keys.departments.all],
    success: 'Department deleted',
    errorTitle: 'The department could not be deleted',
    onSuccess: () => onDone?.(),
  })
}

/* ------------------------------------------------------------ contracts */

export function useContracts(params: TableQuery & Partial<Filters>, enabled = true) {
  return useQuery({
    queryKey: keys.contracts.list(params),
    enabled,
    queryFn: () => api.page<Contract>('/api/contracts', params),
    placeholderData: keepPreviousData,
  })
}

export function useSaveContract(onDone?: (contract: Contract) => void) {
  return useApiMutation<Contract, { id: number | null; body: Record<string, unknown> }>({
    mutationFn: ({ id, body }) =>
      id ? api.put<Contract>(`/api/contracts/${id}`, body) : api.post<Contract>('/api/contracts', body),
    invalidate: [keys.contracts.all, keys.employees.all],
    success: (contract) => `Contract ${contract.reference} saved`,
    errorTitle: 'The contract could not be saved',
    // Overlap is shown inline against the dates, where the conflict actually is.
    onError: (error) => (error as { code?: string })?.code === 'CONTRACT_OVERLAP',
    onSuccess: (contract) => onDone?.(contract),
  })
}

export function useContractAction(onDone?: () => void) {
  return useApiMutation<Contract, { id: number; action: 'activate' | 'cancel' }>({
    mutationFn: ({ id, action }) => api.post<Contract>(`/api/contracts/${id}/${action}`),
    invalidate: [keys.contracts.all, keys.employees.all],
    success: (contract, vars) => (vars.action === 'activate' ? 'Contract activated' : 'Contract cancelled'),
    errorTitle: 'The contract could not be updated',
    onSuccess: () => onDone?.(),
  })
}

export function useDeleteContract(onDone?: () => void) {
  return useApiMutation<void, number>({
    mutationFn: (id) => api.del(`/api/contracts/${id}`),
    invalidate: [keys.contracts.all],
    success: 'Draft contract deleted',
    errorTitle: 'The contract could not be deleted',
    onSuccess: () => onDone?.(),
  })
}

/* --------------------------------------------------- contract templates */

export function useContractTemplates(params: TableQuery & Partial<Filters>, enabled = true) {
  return useQuery({
    queryKey: keys.contractTemplates.list(params),
    enabled,
    queryFn: () => api.page<ContractTemplate>('/api/contract-templates', params),
    placeholderData: keepPreviousData,
  })
}

/** Active templates for the employee form's picker. */
export function useContractTemplateOptions(enabled = true) {
  return useQuery({
    queryKey: keys.contractTemplates.options,
    enabled,
    staleTime: 120_000,
    queryFn: () => api.page<ContractTemplate>('/api/contract-templates', { size: 200, active: true, sort: 'name,asc' }),
  })
}

export function useSaveContractTemplate(onDone?: () => void) {
  return useApiMutation<ContractTemplate, { id: number | null; body: Record<string, unknown> }>({
    mutationFn: ({ id, body }) =>
      id
        ? api.put<ContractTemplate>(`/api/contract-templates/${id}`, body)
        : api.post<ContractTemplate>('/api/contract-templates', body),
    invalidate: [keys.contractTemplates.all],
    success: 'Contract template saved',
    errorTitle: 'The template could not be saved',
    onSuccess: () => onDone?.(),
  })
}

export function useDeleteContractTemplate(onDone?: () => void) {
  return useApiMutation<void, number>({
    mutationFn: (id) => api.del(`/api/contract-templates/${id}`),
    invalidate: [keys.contractTemplates.all],
    success: 'Contract template deleted',
    errorTitle: 'The template could not be deleted',
    onSuccess: () => onDone?.(),
  })
}

/* ------------------------------------------------------------ schedules */

export function useSchedules(params: TableQuery & Partial<Filters>) {
  return useQuery({
    queryKey: keys.schedules.list(params),
    queryFn: () => api.page<WorkingSchedule>('/api/schedules', params),
    placeholderData: keepPreviousData,
  })
}

export function useScheduleNames() {
  return useQuery({
    queryKey: keys.schedules.names,
    queryFn: () => api.get<ScheduleName[]>('/api/schedules/names'),
    staleTime: 300_000,
  })
}

export function useSaveSchedule(onDone?: () => void) {
  return useApiMutation<WorkingSchedule, { id: number | null; body: Record<string, unknown> }>({
    mutationFn: ({ id, body }) =>
      id ? api.put<WorkingSchedule>(`/api/schedules/${id}`, body) : api.post<WorkingSchedule>('/api/schedules', body),
    invalidate: [keys.schedules.all, keys.employees.all],
    success: (schedule) => `${schedule.name} saved · ${schedule.weeklyHours} hours a week`,
    errorTitle: 'The schedule could not be saved',
    onSuccess: () => onDone?.(),
  })
}

export function useDeleteSchedule(onDone?: () => void) {
  return useApiMutation<void, number>({
    mutationFn: (id) => api.del(`/api/schedules/${id}`),
    invalidate: [keys.schedules.all],
    success: 'Schedule deleted',
    errorTitle: 'The schedule could not be deleted',
    onSuccess: () => onDone?.(),
  })
}

export type { Page }
