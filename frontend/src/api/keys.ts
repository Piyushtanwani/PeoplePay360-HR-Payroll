import type { TableQuery } from '@/lib/hooks/useTableState'

type Filters = Record<string, unknown>

/**
 * Every query key in one place.
 *
 * Keys are built as `[resource, kind, ...]` so invalidating a resource root refreshes all of its
 * lists at once. Two screens once shared the literal key `['employees','options']` while fetching
 * different things, and whichever mounted first decided what the other saw.
 */
export const keys = {
  me: {
    all: ['me'] as const,
    profile: ['me', 'profile'] as const,
    dashboard: ['me', 'dashboard'] as const,
  },
  employees: {
    all: ['employees'] as const,
    list: (params: TableQuery & Filters) => ['employees', 'list', params] as const,
    options: ['employees', 'options'] as const,
    detail: (id: number) => ['employees', 'detail', id] as const,
  },
  departments: { all: ['departments'] as const },
  contracts: {
    all: ['contracts'] as const,
    list: (params: TableQuery & Filters) => ['contracts', 'list', params] as const,
  },
  contractTemplates: {
    all: ['contract-templates'] as const,
    list: (params: TableQuery & Filters) => ['contract-templates', 'list', params] as const,
    options: ['contract-templates', 'options'] as const,
  },
  schedules: {
    all: ['schedules'] as const,
    list: (params: TableQuery & Filters) => ['schedules', 'list', params] as const,
    names: ['schedules', 'names'] as const,
  },
  attendance: {
    all: ['attendance'] as const,
    list: (params: TableQuery & Filters) => ['attendance', 'list', params] as const,
    exceptions: (params: TableQuery & Filters) => ['attendance', 'exceptions', params] as const,
    today: ['attendance', 'today'] as const,
    rules: ['attendance', 'rules'] as const,
  },
  timeoff: {
    all: ['timeoff'] as const,
    types: ['timeoff', 'types'] as const,
    holidays: (year: number) => ['timeoff', 'holidays', year] as const,
    balances: (employeeId: number | 'me') => ['timeoff', 'balances', employeeId] as const,
    requests: (params: TableQuery & Filters) => ['timeoff', 'requests', params] as const,
    allocations: (params: TableQuery & Filters) => ['timeoff', 'allocations', params] as const,
    simulate: (input: Filters) => ['timeoff', 'simulate', input] as const,
  },
  payruns: {
    all: ['payruns'] as const,
    list: (params: TableQuery & Filters) => ['payruns', 'list', params] as const,
    detail: (id: number) => ['payruns', 'detail', id] as const,
    issues: (id: number, filters?: Filters) => ['payruns', 'issues', id, filters ?? {}] as const,
    delivery: (id: number) => ['payruns', 'delivery', id] as const,
  },
  payslips: {
    all: ['payslips'] as const,
    list: (params: TableQuery & Filters) => ['payslips', 'list', params] as const,
    detail: (id: number) => ['payslips', 'detail', id] as const,
    variance: (id: number) => ['payslips', 'variance', id] as const,
  },
  structures: {
    all: ['structures'] as const,
    list: (params: TableQuery & Filters) => ['structures', 'list', params] as const,
    names: ['structures', 'names'] as const,
    detail: (id: number) => ['structures', 'detail', id] as const,
    rules: (params: TableQuery & Filters) => ['structures', 'rules', params] as const,
    formulaHelp: ['structures', 'formula-help'] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    hr: (filters: Filters) => ['dashboard', 'hr', filters] as const,
  },
  admin: {
    all: ['admin'] as const,
    users: (params: TableQuery & Filters) => ['admin', 'users', params] as const,
    userOptions: ['admin', 'users', 'options'] as const,
    userDetail: (id: number) => ['admin', 'users', 'detail', id] as const,
    userPermissions: (id: number) => ['admin', 'users', 'permissions', id] as const,
    permissionCatalogue: ['admin', 'permissions'] as const,
    audit: (params: TableQuery & Filters) => ['admin', 'audit', params] as const,
    auditSummary: (filters: Filters) => ['admin', 'audit', 'summary', filters] as const,
    health: ['admin', 'health'] as const,
  },
} as const
