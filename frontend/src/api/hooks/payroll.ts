import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, type QueryValue } from '../client'
import { keys } from '../keys'
import { useApiMutation } from '../mutation'
import type {
  DryRunResult, EligibleEmployee, Payrun, PayrunIssue, Payslip, SalaryRule, SalaryRuleRow,
  SalaryStructure, SalaryStructureName,
} from '../types'
import type { TableQuery } from '@/lib/hooks/useTableState'

/** Endpoint-specific filters, alongside the paging the table controller supplies. */
type Filters = Record<string, QueryValue>

/* --------------------------------------------------------------- payruns */

export function usePayruns(params: TableQuery & Partial<Filters>, enabled = true) {
  return useQuery({
    queryKey: keys.payruns.list(params),
    enabled,
    queryFn: () => api.page<Payrun>('/api/payruns', params),
    placeholderData: keepPreviousData,
  })
}

export function usePayrun(id: number | null, options: { refetchInterval?: number } = {}) {
  return useQuery({
    queryKey: keys.payruns.detail(id ?? 0),
    enabled: id !== null,
    queryFn: () => api.get<Payrun>(`/api/payruns/${id}`),
    refetchInterval: options.refetchInterval,
  })
}

export function usePayrunIssues(id: number | null, filters: Filters = {}) {
  return useQuery({
    queryKey: keys.payruns.issues(id ?? 0, filters),
    enabled: id !== null,
    queryFn: () => api.get<PayrunIssue[]>(`/api/payruns/${id}/issues`, filters),
  })
}

export function usePayrunDelivery(id: number | null, polling: boolean) {
  return useQuery({
    queryKey: keys.payruns.delivery(id ?? 0),
    enabled: id !== null,
    queryFn: () =>
      api.get<{ rows: { payslipId: number; employeeName: string; status: string; sentAt: string | null; recipient: string | null }[]; summary: Record<string, number> }>(
        `/api/payruns/${id}/delivery`,
      ),
    refetchInterval: polling ? 3000 : false,
  })
}

export function useEligibility() {
  return useApiMutation<EligibleEmployee[], { structureId: number; periodStart: string; periodEnd: string }>({
    mutationFn: (body) => api.post<EligibleEmployee[]>('/api/payruns/eligibility', body),
    errorTitle: 'The employee list could not be loaded',
  })
}

export function useCreatePayrun(onDone?: (payrun: Payrun) => void) {
  return useApiMutation<Payrun, Record<string, unknown>>({
    mutationFn: (body) => api.post<Payrun>('/api/payruns', body),
    invalidate: [keys.payruns.all],
    success: (payrun) => `${payrun.name} created with ${payrun.employeeCount} employees`,
    errorTitle: 'The payrun could not be created',
    onSuccess: (payrun) => onDone?.(payrun),
  })
}

/** The state transitions, which share a shape and all need the same confirmation and reporting. */
export function usePayrunAction(id: number) {
  return useApiMutation<unknown, { action: 'compute' | 'validate' | 'pay' | 'send' | 'cancel'; body?: unknown }>({
    mutationFn: ({ action, body }) => api.post(`/api/payruns/${id}/${action}`, body),
    invalidate: [keys.payruns.all, keys.payslips.all, keys.dashboard.all],
    success: (_data, vars) =>
      ({
        compute: 'Payslips calculated',
        validate: 'Payrun validated and ready for payment',
        pay: 'Payrun marked as paid',
        send: 'Payslips queued for sending',
        cancel: 'Payrun cancelled',
      })[vars.action],
    errorTitle: 'That step could not be completed',
  })
}

export function useOverrideIssue(payrunId: number) {
  return useApiMutation<void, { issueId: number; reason: string }>({
    mutationFn: ({ issueId, reason }) =>
      api.post(`/api/payruns/${payrunId}/issues/${issueId}/override`, { reason }),
    invalidate: [keys.payruns.all],
    success: 'Issue overridden. The reason is on the audit trail.',
    errorTitle: 'The issue could not be overridden',
  })
}

export function useAddPayrunInput(payrunId: number, onDone?: () => void) {
  return useApiMutation<void, { employeeId: number; code: string; value: number }>({
    mutationFn: (body) => api.post(`/api/payruns/${payrunId}/inputs`, body),
    invalidate: [keys.payruns.all, keys.payslips.all],
    success: 'Input saved. Recompute the payrun to apply it.',
    errorTitle: 'The input could not be saved',
    onSuccess: () => onDone?.(),
  })
}

/* -------------------------------------------------------------- payslips */

export function usePayslips(params: TableQuery & Partial<Filters>, enabled = true) {
  return useQuery({
    queryKey: keys.payslips.list(params),
    enabled,
    queryFn: () => api.page<Payslip>('/api/payslips', params),
    placeholderData: keepPreviousData,
  })
}

export function usePayslip(id: number | null) {
  return useQuery({
    queryKey: keys.payslips.detail(id ?? 0),
    enabled: id !== null,
    queryFn: () => api.get<Payslip>(`/api/payslips/${id}`),
  })
}

export function usePayslipVariance(id: number | null, enabled: boolean) {
  return useQuery({
    queryKey: keys.payslips.variance(id ?? 0),
    enabled: id !== null && enabled,
    queryFn: () =>
      api.get<{
        previousPayslipId: number | null
        netDelta: number
        netDeltaPct: number
        lineDeltas: { ruleCode: string; previous: number; current: number; delta: number }[]
      }>(`/api/payslips/${id}/variance`),
  })
}

export function useSavePayslipNote(onDone?: () => void) {
  return useApiMutation<void, { id: number; note: string }>({
    mutationFn: ({ id, note }) => api.put(`/api/payslips/${id}/note`, { note }),
    invalidate: [keys.payslips.all],
    success: 'Note saved',
    errorTitle: 'The note could not be saved',
    onSuccess: () => onDone?.(),
  })
}

/* ------------------------------------------------------ salary structures */

export function useStructures(params: TableQuery & Partial<Filters>) {
  return useQuery({
    queryKey: keys.structures.list(params),
    queryFn: () => api.page<SalaryStructure>('/api/salary-structures', params),
    placeholderData: keepPreviousData,
  })
}

export function useStructureNames(enabled = true) {
  return useQuery({
    queryKey: keys.structures.names,
    enabled,
    staleTime: 300_000,
    queryFn: () => api.get<SalaryStructureName[]>('/api/salary-structures/names'),
  })
}

export function useStructure(id: number | null) {
  return useQuery({
    queryKey: keys.structures.detail(id ?? 0),
    enabled: id !== null,
    queryFn: () => api.get<SalaryStructure>(`/api/salary-structures/${id}`),
  })
}

export function useAllRules(params: TableQuery & Partial<Filters>) {
  return useQuery({
    queryKey: keys.structures.rules(params),
    queryFn: () => api.page<SalaryRuleRow>('/api/salary-structures/rules/all', params),
    placeholderData: keepPreviousData,
  })
}

export function useFormulaHelp(enabled: boolean) {
  return useQuery({
    queryKey: keys.structures.formulaHelp,
    enabled,
    staleTime: 3_600_000,
    queryFn: () =>
      api.get<{ variables: { name: string; description: string }[]; functions: string[]; example: string }>(
        '/api/salary-structures/formula-help',
      ),
  })
}

export function useSaveStructure(onDone?: (structure: SalaryStructure) => void) {
  return useApiMutation<SalaryStructure, { id: number | null; body: Record<string, unknown> }>({
    mutationFn: ({ id, body }) =>
      id
        ? api.put<SalaryStructure>(`/api/salary-structures/${id}`, body)
        : api.post<SalaryStructure>('/api/salary-structures', body),
    invalidate: [keys.structures.all],
    success: 'Salary structure saved',
    errorTitle: 'The structure could not be saved',
    onSuccess: (structure) => onDone?.(structure),
  })
}

export function useDeleteStructure(onDone?: () => void) {
  return useApiMutation<void, number>({
    mutationFn: (id) => api.del(`/api/salary-structures/${id}`),
    invalidate: [keys.structures.all],
    success: 'Salary structure deleted',
    errorTitle: 'The structure could not be deleted',
    onSuccess: () => onDone?.(),
  })
}

export function useSaveRule(structureId: number, onDone?: () => void) {
  return useApiMutation<SalaryRule, { ruleId: number | null; body: Record<string, unknown> }>({
    mutationFn: ({ ruleId, body }) =>
      ruleId
        ? api.put<SalaryRule>(`/api/salary-structures/${structureId}/rules/${ruleId}`, body)
        : api.post<SalaryRule>(`/api/salary-structures/${structureId}/rules`, body),
    invalidate: [keys.structures.all],
    success: 'Rule saved',
    errorTitle: 'The rule could not be saved',
    onSuccess: () => onDone?.(),
  })
}

export function useDeleteRule(structureId: number, onDone?: () => void) {
  return useApiMutation<void, number>({
    mutationFn: (ruleId) => api.del(`/api/salary-structures/${structureId}/rules/${ruleId}`),
    invalidate: [keys.structures.all],
    success: 'Rule deleted',
    errorTitle: 'The rule could not be deleted',
    onSuccess: () => onDone?.(),
  })
}

export function useReorderRules(structureId: number) {
  return useApiMutation<SalaryStructure, number[]>({
    mutationFn: (orderedRuleIds) =>
      api.put<SalaryStructure>(`/api/salary-structures/${structureId}/rules/reorder`, { orderedRuleIds }),
    invalidate: [keys.structures.all],
    success: 'Rule order saved',
    errorTitle: 'The rules could not be reordered',
  })
}

export function useSetRuleActive(structureId: number) {
  return useApiMutation<SalaryRule, { ruleId: number; active: boolean }>({
    mutationFn: ({ ruleId, active }) =>
      api.patch<SalaryRule>(`/api/salary-structures/${structureId}/rules/${ruleId}/active`, { active }),
    invalidate: [keys.structures.all],
    success: (rule) => `${rule.name} ${rule.active ? 'switched on' : 'switched off'}`,
    errorTitle: 'The rule could not be changed',
  })
}

/**
 * Switches one rule on or off from the cross-structure list, where each row belongs to a different
 * structure and so cannot use a hook bound to one.
 */
export function useSetAnyRuleActive() {
  return useApiMutation<SalaryRule, { structureId: number; ruleId: number; active: boolean }>({
    mutationFn: ({ structureId, ruleId, active }) =>
      api.patch<SalaryRule>(`/api/salary-structures/${structureId}/rules/${ruleId}/active`, { active }),
    invalidate: [keys.structures.all],
    success: (rule) => `${rule.name} ${rule.active ? 'switched on' : 'switched off'}`,
    errorTitle: 'The rule could not be changed',
  })
}

/** Simulates the structure against real people and writes nothing. */
export function useDryRun(structureId: number) {
  return useApiMutation<DryRunResult, { period: string; employeeIds?: number[] }>({
    mutationFn: (body) => api.post<DryRunResult>(`/api/salary-structures/${structureId}/dry-run`, body),
    errorTitle: 'The simulation could not be run',
  })
}
