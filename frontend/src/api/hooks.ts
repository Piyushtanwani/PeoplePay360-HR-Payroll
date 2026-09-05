import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import type { Department, EmployeeSummary, Page, ScheduleName, SalaryStructureName, TimeOffType } from './types'

export function useDepartments() {
  return useQuery({ queryKey: ['departments'], queryFn: () => api.get<Department[]>('/api/departments'), staleTime: 300_000 })
}

export function useScheduleNames() {
  return useQuery({ queryKey: ['schedules', 'names'], queryFn: () => api.get<ScheduleName[]>('/api/schedules/names'), staleTime: 300_000 })
}

export function useStructureNames(enabled = true) {
  return useQuery({
    queryKey: ['structures', 'names'],
    enabled,
    queryFn: () => api.get<SalaryStructureName[]>('/api/salary-structures/names'),
    staleTime: 300_000,
  })
}

export function useTimeOffTypes() {
  return useQuery({ queryKey: ['timeoff', 'types'], queryFn: () => api.get<TimeOffType[]>('/api/timeoff/types'), staleTime: 300_000 })
}

export function useEmployeeOptions(enabled = true) {
  return useQuery({
    queryKey: ['employees', 'options'],
    enabled,
    staleTime: 120_000,
    queryFn: () => api.page<EmployeeSummary>('/api/employees', { size: 200 }),
  })
}
