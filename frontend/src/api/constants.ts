import type { EmployeeType, RoleCode, RuleCategory } from './types'
import type { Tone } from '@/components/ui/status'

/**
 * Option lists and tone maps used by more than one screen.
 *
 * These used to be declared per page, so the same list of employment types existed twice under two
 * names, and a rule category was colour-coded on one screen and grey on another.
 */

export const EMPLOYEE_TYPE_OPTIONS: { value: EmployeeType; label: string }[] = [
  { value: 'FULL_TIME', label: 'Full time' },
  { value: 'PART_TIME', label: 'Part time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERN', label: 'Intern' },
]

export const ROLE_OPTIONS: { value: RoleCode; label: string; description: string }[] = [
  { value: 'EMPLOYEE', label: 'Employee', description: 'Their own attendance, leave, contract and payslips.' },
  { value: 'HR_MANAGER', label: 'HR Manager', description: 'People, time and recruitment. No payroll figures.' },
  { value: 'HR_PAYROLL_USER', label: 'HR Payroll User', description: 'Everything HR, plus preparing payruns.' },
  { value: 'HR_PAYROLL_MANAGER', label: 'HR Payroll Manager', description: 'Also pays, overrides and edits salary rules.' },
  { value: 'ADMIN', label: 'Admin', description: 'Everything, including users, access and the audit trail.' },
]

export const RULE_CATEGORY_OPTIONS: { value: RuleCategory; label: string; description: string }[] = [
  { value: 'BASIC', label: 'Basic', description: 'Core pay. Several basic rules add together.' },
  { value: 'ALLOWANCE', label: 'Allowance', description: 'Added to pay. Several allowances add together.' },
  { value: 'DEDUCTION', label: 'Deduction', description: 'Taken off pay. Several deductions add together.' },
  { value: 'GROSS', label: 'Gross', description: 'Sets gross outright, replacing the running total.' },
  { value: 'NET', label: 'Net', description: 'Sets net outright, replacing the running total.' },
]

export const CATEGORY_TONES: Record<RuleCategory, Tone> = {
  BASIC: 'accent',
  ALLOWANCE: 'ok',
  DEDUCTION: 'bad',
  GROSS: 'teal',
  NET: 'purple',
}

export const COMPUTE_TYPE_OPTIONS = [
  { value: 'FIXED', label: 'Fixed amount' },
  { value: 'PERCENTAGE', label: 'Percentage of another rule' },
  { value: 'FORMULA', label: 'Formula' },
] as const

export const CONTRACT_STATE_OPTIONS = [
  { value: '', label: 'All states' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export const PAYRUN_STATE_OPTIONS = [
  { value: '', label: 'All states' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'COMPUTED', label: 'Computed' },
  { value: 'VALIDATED', label: 'Validated' },
  { value: 'PAID', label: 'Paid' },
  { value: 'SENT', label: 'Sent' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export const ATTENDANCE_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'PRESENT', label: 'Present' },
  { value: 'LATE', label: 'Late' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'OVERTIME', label: 'Overtime' },
  { value: 'MISSING_CHECKOUT', label: 'Missing check-out' },
]

export const EXCEPTION_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'LATE', label: 'Late' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'OVERTIME', label: 'Overtime' },
  { value: 'MISSING_CHECKOUT', label: 'Missing check-out' },
]

export const REQUEST_STATE_OPTIONS = [
  { value: '', label: 'All states' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'NEEDS_ATTENTION', label: 'Needs attention' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REFUSED', label: 'Refused' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export const ALLOCATION_STATE_OPTIONS = [
  { value: '', label: 'All states' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REFUSED', label: 'Refused' },
]

/** Monday first, matching how the schedule stores weekdays (1 = Monday). */
export const WEEKDAYS = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 7, label: 'Sunday', short: 'Sun' },
]

export const BREAK_OPTIONS = [0, 15, 30, 45, 60].map((n) => ({ value: String(n), label: n === 0 ? 'None' : `${n} min` }))

export const AUDIT_CHANNELS = [
  { value: '', label: 'All channels' },
  { value: 'UI', label: 'This web app' },
  { value: 'MCP', label: 'Assistant tools' },
  { value: 'CHAT', label: 'Assistant chat' },
  { value: 'SYSTEM', label: 'Scheduled jobs' },
]

/** What each audit channel means, for the help panel on that screen. */
export const CHANNEL_DESCRIPTIONS: Record<string, string> = {
  UI: 'Someone acting in this web application.',
  MCP: 'A tool call made by the assistant service on someone’s behalf.',
  CHAT: 'A conversation with the assistant.',
  SYSTEM: 'A scheduled job, such as the nightly attendance sweep.',
}

/** Where a resource type in the audit log can be opened. */
export const RESOURCE_LINKS: Record<string, (id: string) => string> = {
  employee: (id) => `/employees/${id}`,
  payrun: (id) => `/payroll/payruns/${id}`,
  payslip: (id) => `/payroll/payslips?payslipId=${id}`,
  salary_structure: (id) => `/payroll/salary-structures?structureId=${id}`,
  contract: (id) => `/contracts?contractId=${id}`,
  working_schedule: (id) => `/schedules?scheduleId=${id}`,
  user: (id) => `/admin/users?userId=${id}`,
  attendance: (id) => `/attendance?attendanceId=${id}`,
}
