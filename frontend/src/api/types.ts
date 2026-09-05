/** Contract-shaped types mirroring Part B (B7) of the shared integration contract. */

export type RoleCode = 'EMPLOYEE' | 'HR_MANAGER' | 'HR_PAYROLL_USER' | 'HR_PAYROLL_MANAGER' | 'ADMIN'
export type EmployeeType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN'
export type ContractState = 'DRAFT' | 'RUNNING' | 'EXPIRED' | 'CANCELLED'
export type AttendanceStatus =
  | 'PRESENT' | 'LATE' | 'ABSENT' | 'OVERTIME' | 'MISSING_CHECKOUT' | 'HOLIDAY' | 'LEAVE'
export type ExceptionType = 'LATE' | 'ABSENT' | 'OVERTIME' | 'MISSING_CHECKOUT'
export type RequestState = 'PENDING' | 'NEEDS_ATTENTION' | 'APPROVED' | 'REFUSED' | 'CANCELLED'
export type AllocationState = 'DRAFT' | 'APPROVED' | 'REFUSED'
export type RuleCategory = 'BASIC' | 'ALLOWANCE' | 'GROSS' | 'DEDUCTION' | 'NET'
export type ComputeType = 'FIXED' | 'PERCENTAGE' | 'FORMULA'
export type PayrunState = 'DRAFT' | 'COMPUTED' | 'VALIDATED' | 'PAID' | 'SENT' | 'CANCELLED'
export type DeliveryStatus = 'NOT_SENT' | 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED_NO_RECIPIENT'
export type IssueSeverity = 'BLOCKER' | 'WARNING'
export type IssueStatus = 'OPEN' | 'RESOLVED' | 'OVERRIDDEN'

export interface Page<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface UserSummary {
  id: number
  email: string
  displayName: string
  roleCode: RoleCode
  employeeId: number | null
  active: boolean
}

export interface MeResponse {
  user: UserSummary
  permissions: string[]
  employee: EmployeeSummary | null
  settings: { currency: string; timezone: string; appName: string; profile: 'demo' | 'prod' }
  features: { chat: boolean; recruitment: boolean }
}

export interface Department { id: number; name: string; employeeCount: number }

export interface EmployeeSummary {
  id: number
  employeeNo: string
  displayName: string
  jobTitle: string
  departmentId: number
  departmentName: string
  employeeType: EmployeeType
  managerId: number | null
  managerName: string | null
  active: boolean
  avatarColor: string
}

export interface Employee extends EmployeeSummary {
  workEmail: string
  hireDate: string
  userId: number | null
  workingScheduleId: number | null
  workingScheduleName: string | null
  activeContractId: number | null
  bankAccount: { bankName: string; accountLast4: string; hasAccount: boolean } | null
  counts: { contracts: number; attendance: number; timeOffRequests: number; allocations: number }
}

export interface ScheduleLine { dayOfWeek: number; startTime: string; endTime: string; breakMinutes: number }
export interface WorkingSchedule {
  id: number
  name: string
  type: 'FIXED' | 'FLEXIBLE'
  weeklyHours: number
  active: boolean
  companyName: string
  lines: ScheduleLine[]
}
export interface ScheduleName { id: number; name: string; weeklyHours: number }

export interface Contract {
  id: number
  employeeId: number
  employeeName: string
  reference: string
  wage: number | null
  wageType: 'MONTHLY' | 'HOURLY' | null
  startDate: string
  endDate: string | null
  state: ContractState
  workingScheduleId: number | null
  workingScheduleName: string | null
  salaryStructureId: number | null
  salaryStructureName: string | null
  jobTitle: string
  departmentId: number
  departmentName: string
  isActiveNow: boolean
  version: number
}

export interface Attendance {
  id: number
  employeeId: number
  employeeName: string
  workDate: string
  checkIn: string | null
  checkOut: string | null
  workedMinutes: number
  scheduledMinutes: number
  status: AttendanceStatus
  isManualEdit: boolean
  editedBy: string | null
  editReason: string | null
}

export interface AttendanceException {
  id: number
  employeeId: number
  employeeName: string
  date: string
  type: ExceptionType
  minutes: number
  resolved: boolean
  attendanceId: number
}

export interface TimeOffType {
  id: number
  name: string
  code: string
  unit: 'DAYS'
  isPaid: boolean
  requiresAllocation: boolean
  color: string
  active: boolean
}

export interface TimeOffAllocation {
  id: number
  employeeId: number
  employeeName: string
  typeId: number
  typeName: string
  days: number
  validFrom: string
  validTo: string | null
  state: AllocationState
  approvedBy: string | null
  approvedAt: string | null
  note: string | null
}

export interface TimeOffRequest {
  id: number
  employeeId: number
  employeeName: string
  typeId: number
  typeName: string
  startDate: string
  endDate: string
  days: number
  state: RequestState
  reason: string | null
  anomaly: string | null
  decidedBy: string | null
  decidedAt: string | null
  decisionNote: string | null
}

export interface LeaveBalance {
  employeeId: number
  typeId: number
  typeName: string
  allocated: number
  taken: number
  pending: number
  available: number
  projected: number
}

export interface Holiday { id: number; name: string; date: string }

export interface SalaryRule {
  id: number
  structureId: number
  name: string
  code: string
  category: RuleCategory
  sequence: number
  computeType: ComputeType
  fixedAmount: number | null
  percentage: number | null
  baseRuleCode: string | null
  formula: string | null
  active: boolean
  description: string | null
}

export interface SalaryStructure {
  id: number
  name: string
  code: string
  active: boolean
  ruleCount: number
  employeeCount: number
  rules: SalaryRule[]
}
export interface SalaryStructureName { id: number; name: string }

export interface PayrunIssue {
  id: number
  payrunId: number
  employeeId: number
  employeeName: string
  checkCode: string
  severity: IssueSeverity
  overridable: boolean
  message: string
  status: IssueStatus
  overrideReason: string | null
  fixLink: string | null
}

export interface Payrun {
  id: number
  name: string
  structureId: number
  structureName: string
  periodStart: string
  periodEnd: string
  state: PayrunState
  employeeCount: number
  payslipCount: number
  totalNet: number
  totalGross: number
  blockerCount: number
  warningCount: number
  createdBy: string
  createdAt: string
  computedAt: string | null
  validatedAt: string | null
  paidAt: string | null
  sentAt: string | null
}

export interface PayslipLine { ruleCode: string; ruleName: string; category: RuleCategory; sequence: number; amount: number }

export interface Payslip {
  id: number
  payrunId: number
  payrunName: string
  payrunState: PayrunState
  employeeId: number
  employeeName: string
  employeeNo: string
  departmentName: string
  contractId: number
  contractReference: string
  periodStart: string
  periodEnd: string
  workedDays: number
  scheduledDays: number
  unpaidDays: number
  basic: number
  allowances: number
  deductions: number
  gross: number
  net: number
  note: string | null
  lines: PayslipLine[]
  inputs: { code: string; value: number; source: string }[]
  delivery: { status: DeliveryStatus; sentAt: string | null; recipient: string | null }
}

export interface EligibleEmployee {
  employeeId: number
  employeeNo: string
  displayName: string
  departmentName: string
  contractReference: string | null
  contractStructureName: string | null
  eligible: boolean
  reason: string | null
}

export interface DashboardAlert { severity: IssueSeverity | 'INFO'; kind: 'PAYROLL' | 'HR'; message: string; link: string }

export interface Dashboard {
  period: string
  filters: { departmentId: number | null; employeeType: EmployeeType | null }
  kpis: {
    totalNetPaid?: number
    payslipsGenerated?: number
    averageSalary?: number
    approvedTimeOffDays: number
    attendanceHealthPct: number
    payslipsPaid?: number
    payslipsPending?: number
  }
  salaryCostByDepartment?: { departmentName: string; amount: number }[]
  monthlyNetTrend?: { month: string; amount: number }[]
  alerts: DashboardAlert[]
  attendanceOverview: {
    present: number
    late: number
    absent: number
    overtime: number
    missingCheckouts: number
    manualEdits: number
    coveragePct: number
  }
  departments: { departmentName: string; headcount: number; salarySpend?: number }[]
}

export interface Grant {
  id: number
  userId: number
  permissionCode: string
  effect: 'ALLOW' | 'DENY'
  reason: string
  grantedBy: number
  grantedByName: string
  grantedAt: string
  expiresAt: string | null
  revokedAt: string | null
  active: boolean
}

export interface PermissionCatalogItem {
  code: string
  resource: string
  action: string
  scope: string | null
  tier: 'STANDARD' | 'ADMIN'
  description: string
  grantableByMe: boolean
}

export interface AdminUser extends UserSummary {
  employeeName: string | null
  grantCount: number
  lastActiveAt: string | null
}

export interface AuditEvent {
  id: number
  occurredAt: string
  actorUserId: number
  actorName: string
  actorRoles: string
  channel: 'UI' | 'MCP' | 'CHAT' | 'SYSTEM'
  action: string
  resourceType: string
  resourceId: string
  outcome: 'ALLOW' | 'DENY'
  reason: string | null
  beforeJson: string | null
  afterJson: string | null
  requestId: string
}

export interface AiProfile {
  id: number
  name: string
  provider: 'OPENROUTER' | 'NVIDIA' | 'OLLAMA'
  baseUrl: string
  model: string
  apiKeySet: boolean
  apiKeyLast4: string | null
  toolMode: 'AUTO' | 'NATIVE' | 'PROMPTED'
  temperature: number
  maxTokens: number
  isDefault: boolean
  updatedAt: string
  lastTestOk: boolean | null
  lastTestAt: string | null
  lastTestMessage: string | null
}

export interface AiProviderPreset {
  provider: 'OPENROUTER' | 'NVIDIA' | 'OLLAMA'
  label: string
  defaultBaseUrl: string
  requiresApiKey: boolean
  docsUrl: string
}

export interface AiModel { id: string; name: string; supportsTools: boolean | null; contextLength: number | null }

export interface HealthCard { name: string; status: 'UP' | 'DOWN' | 'DEGRADED'; detail: string; latencyMs: number | null }
