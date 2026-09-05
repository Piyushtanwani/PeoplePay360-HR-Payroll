import type { RoleCode } from '@/api/types'

/** B5 — the complete permission catalogue. */
export const ALL_PERMISSIONS = [
  'employee.read.own','employee.read.all','employee.read.sensitive','employee.create.all','employee.update.all','employee.delete.all',
  'contract.read.own','contract.read.all','contract.create.all','contract.update.all','contract.delete.all','contract.activate',
  'schedule.read.all','schedule.create.all','schedule.update.all','schedule.delete.all',
  'attendance.read.own','attendance.read.all','attendance.create.own','attendance.create.all','attendance.update.all','attendance.delete.all',
  'timeoff_type.read','timeoff_type.manage',
  'timeoff_request.read.own','timeoff_request.read.all','timeoff_request.create.own','timeoff_request.create.all','timeoff_request.update.own','timeoff_request.update.all','timeoff_request.delete.all','timeoff_request.approve',
  'timeoff_allocation.read.own','timeoff_allocation.read.all','timeoff_allocation.create.all','timeoff_allocation.update.all','timeoff_allocation.delete.all','timeoff_allocation.approve',
  'salary_structure.list_names','salary_structure.read','salary_structure.create','salary_structure.update','salary_structure.delete','salary_structure.dry_run',
  'salary_rule.read','salary_rule.create','salary_rule.update','salary_rule.delete',
  'payrun.read','payrun.create','payrun.update','payrun.delete','payrun.compute','payrun.validate','payrun.pay','payrun.send','payrun.override_issue','payrun.export',
  'payslip.read.own','payslip.read.all','payslip.update.all','payslip.delete.all',
  'dashboard.read.hr','dashboard.read.payroll',
  'candidate.read','candidate.create','candidate.update','candidate.delete','candidate.compare','candidate.reveal','candidate.convert',
  'chat.access','chat.admin',
  'user.read','user.create','user.update','user.delete','role.assign','permission.grant',
  'audit.read','audit.export','ai.settings','seed.manage',
] as const

export const ADMIN_TIER = new Set([
  'chat.admin','user.read','user.create','user.update','user.delete','role.assign','permission.grant',
  'audit.read','audit.export','ai.settings','seed.manage',
])

export const NEVER_GRANTABLE = new Set(['seed.manage'])

/** B5 — implication rules. */
const IMPLIES: Record<string, string[]> = {
  'candidate.compare': ['candidate.read'],
  'employee.read.all': ['employee.read.own'],
  'contract.read.all': ['contract.read.own'],
  'attendance.read.all': ['attendance.read.own'],
  'timeoff_request.read.all': ['timeoff_request.read.own'],
  'timeoff_allocation.read.all': ['timeoff_allocation.read.own'],
  'payslip.read.all': ['payslip.read.own'],
  'salary_structure.read': ['salary_structure.list_names'],
  'salary_structure.update': ['salary_structure.dry_run'],
}

export function expandImplies(codes: Iterable<string>): Set<string> {
  const out = new Set<string>(codes)
  let changed = true
  while (changed) {
    changed = false
    for (const code of Array.from(out)) {
      for (const implied of IMPLIES[code] ?? []) {
        if (!out.has(implied)) {
          out.add(implied)
          changed = true
        }
      }
    }
  }
  return out
}

const SELF_SERVICE = [
  'employee.read.own','contract.read.own','attendance.read.own','attendance.create.own',
  'timeoff_request.read.own','timeoff_request.create.own','timeoff_request.update.own',
  'timeoff_allocation.read.own','timeoff_type.read','payslip.read.own',
]

const HR = [
  'employee.read.all','employee.read.sensitive','employee.create.all','employee.update.all','employee.delete.all',
  'contract.read.all','contract.create.all','contract.update.all','contract.delete.all','contract.activate',
  'schedule.read.all','schedule.create.all','schedule.update.all','schedule.delete.all',
  'attendance.read.all','attendance.create.all','attendance.update.all','attendance.delete.all',
  'timeoff_type.manage','timeoff_request.read.all','timeoff_request.create.all','timeoff_request.update.all',
  'timeoff_request.delete.all','timeoff_request.approve',
  'timeoff_allocation.read.all','timeoff_allocation.create.all','timeoff_allocation.update.all',
  'timeoff_allocation.delete.all','timeoff_allocation.approve',
  'salary_structure.list_names','dashboard.read.hr',
  'candidate.read','candidate.create','candidate.update','candidate.delete','candidate.compare','candidate.reveal','candidate.convert',
]

const PAYROLL_USER = [
  'payrun.read','payrun.create','payrun.update','payrun.compute','payrun.validate','payrun.send',
  'payslip.read.all','payslip.update.all','salary_structure.read','salary_rule.read','dashboard.read.payroll',
]

const PAYROLL_MANAGER = [
  'payrun.delete','payrun.pay','payrun.override_issue','payrun.export','payslip.delete.all',
  'salary_structure.create','salary_structure.update','salary_structure.delete','salary_structure.dry_run',
  'salary_rule.create','salary_rule.update','salary_rule.delete',
]

const ADMIN_ONLY = [
  'user.read','user.create','user.update','user.delete','role.assign','permission.grant',
  'audit.read','audit.export','chat.admin','ai.settings','seed.manage','chat.access',
]

export const ROLE_PERMISSIONS: Record<RoleCode, string[]> = {
  EMPLOYEE: [...SELF_SERVICE],
  HR_MANAGER: [...SELF_SERVICE, ...HR],
  HR_PAYROLL_USER: [...SELF_SERVICE, ...HR, ...PAYROLL_USER],
  HR_PAYROLL_MANAGER: [...SELF_SERVICE, ...HR, ...PAYROLL_USER, ...PAYROLL_MANAGER],
  ADMIN: [...SELF_SERVICE, ...HR, ...PAYROLL_USER, ...PAYROLL_MANAGER, ...ADMIN_ONLY],
}

export function effectivePermissions(role: RoleCode, grants: { permissionCode: string; effect: 'ALLOW' | 'DENY'; active: boolean }[] = []) {
  const set = new Set(ROLE_PERMISSIONS[role])
  for (const g of grants) {
    if (!g.active) continue
    if (g.effect === 'ALLOW') set.add(g.permissionCode)
    else set.delete(g.permissionCode)
  }
  return expandImplies(set)
}

export const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  'chat.access': 'Use the AI HR assistant',
  'employee.read.sensitive': 'Reveal masked bank account details',
  'payrun.pay': 'Mark a payrun as paid',
  'payrun.validate': 'Validate a computed payrun',
  'payrun.override_issue': 'Override an overridable payroll issue',
  'permission.grant': 'Grant or revoke permissions for other users',
  'audit.read': 'Read the audit log',
  'ai.settings': 'Manage AI provider profiles',
  'seed.manage': 'Reset demo data and switch demo accounts',
}

export function describe(code: string) {
  if (PERMISSION_DESCRIPTIONS[code]) return PERMISSION_DESCRIPTIONS[code]
  const [resource, action, scope] = code.split('.')
  const verb = { read: 'View', create: 'Create', update: 'Edit', delete: 'Delete' }[action] ?? action
  const noun = resource.replace(/_/g, ' ')
  return `${verb} ${noun}${scope === 'own' ? ' (own records only)' : scope === 'all' ? ' (all records)' : ''}`
}

export function parsePermission(code: string): { resource: string; action: string; scope: string | null } {
  const [resource, action, scope] = code.split('.')
  return { resource, action, scope: scope ?? null }
}
