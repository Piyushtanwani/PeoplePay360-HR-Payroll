/* eslint-disable */
/**
 * Deterministic demo dataset mirroring B6 of the shared integration contract.
 * Everything the mock API serves is derived from this module.
 */
import type {
  Attendance, AttendanceException, AuditEvent, AiProfile, Contract, Department, EligibleEmployee,
  Employee, Grant, Holiday, LeaveBalance, Payrun, PayrunIssue, Payslip, PayslipLine, SalaryRule, Dashboard,
  SalaryStructure, TimeOffAllocation, TimeOffRequest, TimeOffType, WorkingSchedule, AdminUser, RoleCode,
} from '@/api/types'
import { effectivePermissions } from '@/auth/permissions'

export const TODAY = new Date('2026-09-05T09:20:00Z')

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20260905)
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]
const between = (lo: number, hi: number) => Math.floor(rnd() * (hi - lo + 1)) + lo

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(d: Date, n: number) { const c = new Date(d); c.setDate(c.getDate() + n); return c }
function atTime(day: Date, hh: number, mm: number) {
  const c = new Date(day); c.setHours(hh, mm, 0, 0); return c.toISOString()
}
export function monthRange(period: string) {
  const [y, m] = period.split('-').map(Number)
  return { start: `${period}-01`, end: isoDate(new Date(y, m, 0)) }
}

/* ------------------------------------------------------------------ org */

export const departments: Department[] = [
  { id: 1, name: 'Operations', employeeCount: 0 },
  { id: 2, name: 'Engineering', employeeCount: 0 },
  { id: 3, name: 'Finance', employeeCount: 0 },
  { id: 4, name: 'Sales', employeeCount: 0 },
]

const AVATAR_COLORS = ['#0A84FF', '#34C759', '#FF9F0A', '#BF5AF2', '#64D2FF', '#FF453A', '#5E5CE6', '#FF375F']

const NAMES = [
  'Taylor Brooks', 'Morgan Diaz', 'Jordan Lee', 'Riley Chen', 'Sam Patel',
  'Avery Nolan', 'Casey Roman', 'Devon Ash', 'Elliot Vance', 'Frankie Moss',
  'Gale Hart', 'Harper Quinn', 'Indigo Rao', 'Jamie Sol', 'Kendall Frost',
  'Logan Pike', 'Marley Suh', 'Noor Abadi', 'Oakley Reed', 'Parker Wu',
  'Quincy Bell', 'Reese Okafor', 'Sasha Lindt', 'Toby Marsh', 'Umi Sato',
  'Val Ferreira', 'Wren Halloway', 'Xander Poe', 'Yara Nasser', 'Zane Alder',
  'Ari Mensah', 'Blair Novak', 'Cameron Ito', 'Dakota Singh', 'Emery Blaise',
  'Finley Ortiz', 'Greer Anand', 'Hollis Marek', 'Ira Duval', 'June Castellan',
]

const TITLES: Record<number, string[]> = {
  1: ['Operations Analyst', 'Warehouse Supervisor', 'Logistics Coordinator', 'Operations Lead'],
  2: ['Software Engineer', 'Senior Engineer', 'QA Engineer', 'Platform Engineer'],
  3: ['Payroll Specialist', 'Financial Analyst', 'Accounts Officer', 'Finance Manager'],
  4: ['Account Executive', 'Sales Development Rep', 'Regional Sales Lead', 'Solutions Consultant'],
}

const TYPES = ['FULL_TIME', 'FULL_TIME', 'FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'] as const

export const employees: Employee[] = NAMES.map((displayName, i) => {
  const id = i + 1
  const departmentId = i < 5 ? [3, 1, 3, 3, 1][i] : ((i % 4) + 1)
  const department = departments.find((d) => d.id === departmentId)!
  const employeeType = i < 5 ? 'FULL_TIME' : pick([...TYPES])
  const scheduleId = employeeType === 'PART_TIME' ? 4 : employeeType === 'CONTRACT' ? 5 : 1
  return {
    id,
    employeeNo: `E-${1000 + id}`,
    displayName,
    jobTitle: i < 5 ? ['Head of People', 'HR Manager', 'Payroll Specialist', 'Payroll Manager', 'Operations Analyst'][i] : pick(TITLES[departmentId]),
    departmentId,
    departmentName: department.name,
    employeeType,
    managerId: i < 2 ? null : ((i % 4) + 1),
    managerName: i < 2 ? null : NAMES[(i % 4)],
    active: true,
    avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
    workEmail: `${displayName.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
    hireDate: isoDate(new Date(2019 + (i % 6), (i * 3) % 12, ((i * 7) % 27) + 1)),
    userId: i < 5 ? i + 1 : null,
    workingScheduleId: scheduleId,
    workingScheduleName: '',
    activeContractId: null,
    bankAccount: i % 13 === 5 ? null : { bankName: pick(['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank']), accountLast4: String(between(1000, 9999)), hasAccount: true },
    counts: { contracts: 0, attendance: 0, timeOffRequests: 0, allocations: 0 },
  }
})
for (const d of departments) d.employeeCount = employees.filter((e) => e.departmentId === d.id).length

/* ------------------------------------------------------------ schedules */

function weekdayLines(start: string, end: string, breakMinutes: number, days = [1, 2, 3, 4, 5]) {
  return days.map((dayOfWeek) => ({ dayOfWeek, startTime: start, endTime: end, breakMinutes }))
}
function weeklyHours(lines: { startTime: string; endTime: string; breakMinutes: number }[]) {
  const total = lines.reduce((sum, l) => {
    const [sh, sm] = l.startTime.split(':').map(Number)
    const [eh, em] = l.endTime.split(':').map(Number)
    return sum + (eh * 60 + em - (sh * 60 + sm) - l.breakMinutes)
  }, 0)
  return Math.round((total / 60) * 100) / 100
}
function schedule(id: number, name: string, type: 'FIXED' | 'FLEXIBLE', lines: WorkingSchedule['lines'], active = true): WorkingSchedule {
  return { id, name, type, weeklyHours: weeklyHours(lines), active, companyName: 'OXP Pvt Ltd', lines }
}

export const schedules: WorkingSchedule[] = [
  schedule(1, 'Standard 37.5h', 'FIXED', weekdayLines('09:00', '17:30', 60)),
  schedule(2, 'Night Shift', 'FIXED', weekdayLines('22:00', '06:00', 45)),
  schedule(3, 'Retail Weekend', 'FIXED', weekdayLines('10:00', '19:00', 60, [3, 4, 5, 6, 7])),
  schedule(4, 'Part-time 20h', 'FIXED', weekdayLines('09:00', '14:00', 0, [1, 2, 3, 4])),
  schedule(5, 'Flexible Hybrid', 'FLEXIBLE', weekdayLines('09:30', '18:00', 60)),
]
for (const e of employees) e.workingScheduleName = schedules.find((s) => s.id === e.workingScheduleId)?.name ?? null

/* --------------------------------------------------- salary structures */

let ruleId = 0
function rule(structureId: number, p: Partial<SalaryRule> & { name: string; code: string; category: SalaryRule['category']; sequence: number }): SalaryRule {
  return {
    id: ++ruleId, structureId, active: true, description: null, fixedAmount: null, percentage: null,
    baseRuleCode: null, formula: null, computeType: 'FIXED', ...p,
  }
}

const standardRules = (sid: number): SalaryRule[] => [
  rule(sid, { name: 'Basic Salary', code: 'BASIC', category: 'BASIC', sequence: 1, computeType: 'PERCENTAGE', percentage: 50, baseRuleCode: 'WAGE', description: 'Fifty percent of the contract wage.' }),
  rule(sid, { name: 'House Rent Allowance', code: 'HRA', category: 'ALLOWANCE', sequence: 10, computeType: 'PERCENTAGE', percentage: 40, baseRuleCode: 'BASIC' }),
  rule(sid, { name: 'Standard Allowance', code: 'STD', category: 'ALLOWANCE', sequence: 20, computeType: 'FIXED', fixedAmount: 10000 }),
  rule(sid, { name: 'Performance Bonus', code: 'BONUS', category: 'ALLOWANCE', sequence: 30, computeType: 'FORMULA', formula: "result = inputs['BONUS'] or 0" }),
  rule(sid, { name: 'Leave Travel Allowance', code: 'LTA', category: 'ALLOWANCE', sequence: 40, computeType: 'FIXED', fixedAmount: 5000 }),
  rule(sid, { name: 'Fixed Allowance', code: 'FIX', category: 'ALLOWANCE', sequence: 50, computeType: 'FIXED', fixedAmount: 2500 }),
  rule(sid, { name: 'Gross Salary', code: 'GROSS', category: 'GROSS', sequence: 60, computeType: 'FORMULA', formula: "result = categories['BASIC'] + categories['ALLOWANCE']" }),
  rule(sid, { name: 'LWF Fund', code: 'LWF', category: 'DEDUCTION', sequence: 70, computeType: 'FIXED', fixedAmount: 200 }),
  rule(sid, { name: 'Provident Fund', code: 'PF', category: 'DEDUCTION', sequence: 80, computeType: 'PERCENTAGE', percentage: 12, baseRuleCode: 'BASIC' }),
  rule(sid, { name: 'ESIC', code: 'ESIC', category: 'DEDUCTION', sequence: 90, computeType: 'PERCENTAGE', percentage: 0.75, baseRuleCode: 'GROSS' }),
  rule(sid, { name: 'Professional Tax', code: 'PT', category: 'DEDUCTION', sequence: 100, computeType: 'FIXED', fixedAmount: 200 }),
  rule(sid, { name: 'Net Salary', code: 'NET', category: 'NET', sequence: 110, computeType: 'FORMULA', formula: "result = categories['GROSS'] - categories['DEDUCTION']" }),
]

export const structures: SalaryStructure[] = [
  { id: 1, name: 'Standard Monthly', code: 'STD_MONTHLY', active: true, ruleCount: 12, employeeCount: 0, rules: standardRules(1) },
  { id: 2, name: 'Intern Salary', code: 'INTERN', active: true, ruleCount: 4, employeeCount: 0, rules: [
    rule(2, { name: 'Stipend', code: 'BASIC', category: 'BASIC', sequence: 1, computeType: 'PERCENTAGE', percentage: 100, baseRuleCode: 'WAGE' }),
    rule(2, { name: 'Travel Support', code: 'STD', category: 'ALLOWANCE', sequence: 10, computeType: 'FIXED', fixedAmount: 2000 }),
    rule(2, { name: 'Gross Salary', code: 'GROSS', category: 'GROSS', sequence: 60, computeType: 'FORMULA', formula: "result = categories['BASIC'] + categories['ALLOWANCE']" }),
    rule(2, { name: 'Net Salary', code: 'NET', category: 'NET', sequence: 110, computeType: 'FORMULA', formula: "result = categories['GROSS']" }),
  ] },
  { id: 3, name: 'Contractor', code: 'CONTRACTOR', active: true, ruleCount: 3, employeeCount: 0, rules: [
    rule(3, { name: 'Contract Fee', code: 'BASIC', category: 'BASIC', sequence: 1, computeType: 'PERCENTAGE', percentage: 100, baseRuleCode: 'WAGE' }),
    rule(3, { name: 'Gross Salary', code: 'GROSS', category: 'GROSS', sequence: 60, computeType: 'FORMULA', formula: "result = categories['BASIC']" }),
    rule(3, { name: 'Net Salary', code: 'NET', category: 'NET', sequence: 110, computeType: 'FORMULA', formula: "result = categories['GROSS']" }),
  ] },
]

/* ------------------------------------------------------------ contracts */

function structureFor(e: Employee) {
  if (e.employeeType === 'INTERN') return structures[1]
  if (e.employeeType === 'CONTRACT') return structures[2]
  return structures[0]
}
function wageFor(e: Employee) {
  const base = e.employeeType === 'INTERN' ? 18000 : e.employeeType === 'PART_TIME' ? 32000 : e.employeeType === 'CONTRACT' ? 70000 : 55000
  return base + between(0, 12) * 2500
}

let contractId = 0
export const contracts: Contract[] = []
/** One employee deliberately has no contract valid in the current period (B6). */
export const EMPLOYEE_WITHOUT_CONTRACT = 27

for (const e of employees) {
  const structure = structureFor(e)
  const wage = wageFor(e)
  // historical contract for roughly a third of the workforce
  if (e.id % 3 === 0) {
    contracts.push({
      id: ++contractId, employeeId: e.id, employeeName: e.displayName, reference: `C-${String(1000 + contractId).slice(1)}`,
      wage: Math.round(wage * 0.9), wageType: 'MONTHLY', startDate: '2024-07-01', endDate: '2025-12-31', state: 'EXPIRED',
      workingScheduleId: e.workingScheduleId, workingScheduleName: e.workingScheduleName,
      salaryStructureId: structure.id, salaryStructureName: structure.name, jobTitle: e.jobTitle,
      departmentId: e.departmentId, departmentName: e.departmentName, isActiveNow: false, version: 1,
    })
  }
  if (e.id === EMPLOYEE_WITHOUT_CONTRACT) continue
  const c: Contract = {
    id: ++contractId, employeeId: e.id, employeeName: e.displayName, reference: `C-${String(1000 + contractId).slice(1)}`,
    wage, wageType: 'MONTHLY', startDate: '2026-01-01', endDate: null, state: 'RUNNING',
    workingScheduleId: e.workingScheduleId, workingScheduleName: e.workingScheduleName,
    salaryStructureId: structure.id, salaryStructureName: structure.name, jobTitle: e.jobTitle,
    departmentId: e.departmentId, departmentName: e.departmentName, isActiveNow: true, version: 1,
  }
  contracts.push(c)
  e.activeContractId = c.id
}
for (const s of structures) s.employeeCount = contracts.filter((c) => c.state === 'RUNNING' && c.salaryStructureId === s.id).length
for (const e of employees) e.counts.contracts = contracts.filter((c) => c.employeeId === e.id).length

export function activeContract(employeeId: number, on: string) {
  return contracts.find(
    (c) => c.employeeId === employeeId && c.state === 'RUNNING' && c.startDate <= on && (!c.endDate || c.endDate >= on),
  )
}

/* ----------------------------------------------------------- attendance */

let attendanceId = 0
let exceptionId = 0
export const attendance: Attendance[] = []
export const exceptions: AttendanceException[] = []

const ATT_DAYS = 90
for (let back = ATT_DAYS; back >= 0; back--) {
  const day = addDays(TODAY, -back)
  const dow = day.getDay() === 0 ? 7 : day.getDay()
  if (dow > 5) continue
  for (const e of employees) {
    const sched = schedules.find((s) => s.id === e.workingScheduleId)!
    const line = sched.lines.find((l) => l.dayOfWeek === dow)
    if (!line) continue
    const [sh, sm] = line.startTime.split(':').map(Number)
    const [eh, em] = line.endTime.split(':').map(Number)
    const scheduledMinutes = eh * 60 + em - (sh * 60 + sm) - line.breakMinutes
    const roll = rnd()
    let status: Attendance['status'] = 'PRESENT'
    let checkIn: string | null = atTime(day, sh, sm + between(-4, 4))
    let checkOut: string | null = atTime(day, eh, em + between(-6, 12))
    if (roll > 0.965) { status = 'ABSENT'; checkIn = null; checkOut = null }
    else if (roll > 0.93) { status = 'MISSING_CHECKOUT'; checkOut = null }
    else if (roll > 0.85) { status = 'LATE'; checkIn = atTime(day, sh, sm + between(18, 55)) }
    else if (roll > 0.78) { status = 'OVERTIME'; checkOut = atTime(day, eh + 2, em) }
    const workedMinutes = checkIn && checkOut ? Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000) - line.breakMinutes : 0
    const row: Attendance = {
      id: ++attendanceId, employeeId: e.id, employeeName: e.displayName, workDate: isoDate(day),
      checkIn, checkOut, workedMinutes: Math.max(0, workedMinutes), scheduledMinutes, status,
      isManualEdit: rnd() > 0.985, editedBy: null, editReason: null,
    }
    if (row.isManualEdit) { row.editedBy = 'Morgan Diaz'; row.editReason = 'Employee forgot to punch out' }
    attendance.push(row)
    if (status === 'LATE' || status === 'ABSENT' || status === 'OVERTIME' || status === 'MISSING_CHECKOUT') {
      exceptions.push({
        id: ++exceptionId, employeeId: e.id, employeeName: e.displayName, date: row.workDate, type: status,
        minutes: status === 'LATE' ? between(18, 55) : status === 'OVERTIME' ? 120 : scheduledMinutes,
        resolved: false, attendanceId: row.id,
      })
    }
  }
}
/** B6: Sam Patel has a missing check-out on 18 August 2026. */
{
  const row = attendance.find((a) => a.employeeId === 5 && a.workDate === '2026-08-18')
  if (row) { row.status = 'MISSING_CHECKOUT'; row.checkOut = null; row.workedMinutes = 0 }
}
for (const e of employees) e.counts.attendance = attendance.filter((a) => a.employeeId === e.id).length

/* -------------------------------------------------------------- time off */

export const timeOffTypes: TimeOffType[] = [
  { id: 1, name: 'Annual Leave', code: 'ANNUAL', unit: 'DAYS', isPaid: true, requiresAllocation: true, color: '#0A84FF', active: true },
  { id: 2, name: 'Sick Leave', code: 'SICK', unit: 'DAYS', isPaid: true, requiresAllocation: true, color: '#FF9F0A', active: true },
  { id: 3, name: 'Unpaid Leave', code: 'UNPAID', unit: 'DAYS', isPaid: false, requiresAllocation: false, color: '#98989D', active: true },
]

export const holidays: Holiday[] = [
  { id: 1, name: 'Republic Day', date: '2026-01-26' },
  { id: 2, name: 'Holi', date: '2026-03-04' },
  { id: 3, name: 'Independence Day', date: '2026-08-15' },
  { id: 4, name: 'Gandhi Jayanti', date: '2026-10-02' },
  { id: 5, name: 'Diwali', date: '2026-11-08' },
  { id: 6, name: 'Christmas Day', date: '2026-12-25' },
]

let allocationId = 0
export const allocations: TimeOffAllocation[] = []
for (const e of employees) {
  for (const type of timeOffTypes.filter((t) => t.requiresAllocation)) {
    const isSamAnnual = e.id === 5 && type.id === 1
    allocations.push({
      id: ++allocationId, employeeId: e.id, employeeName: e.displayName, typeId: type.id, typeName: type.name,
      days: isSamAnnual ? 10 : type.id === 1 ? 20 : 8,
      validFrom: '2026-01-01', validTo: '2026-12-31',
      state: isSamAnnual ? 'DRAFT' : 'APPROVED',
      approvedBy: isSamAnnual ? null : 'Morgan Diaz', approvedAt: isSamAnnual ? null : '2026-01-02T04:30:00Z',
      note: type.id === 1 ? 'Annual leave balance granted at start of policy year.' : 'Statutory sick leave balance.',
    })
  }
}
for (const e of employees) e.counts.allocations = allocations.filter((a) => a.employeeId === e.id).length

let requestId = 0
export const requests: TimeOffRequest[] = []
function addRequest(p: Omit<TimeOffRequest, 'id' | 'employeeName' | 'typeName'>) {
  const employee = employees.find((e) => e.id === p.employeeId)!
  const type = timeOffTypes.find((t) => t.id === p.typeId)!
  requests.push({ ...p, id: ++requestId, employeeName: employee.displayName, typeName: type.name })
}
for (const e of employees) {
  const count = between(0, 3)
  for (let i = 0; i < count; i++) {
    const start = addDays(TODAY, between(-120, 30))
    const days = between(1, 4)
    const state: TimeOffRequest['state'] = start < TODAY ? 'APPROVED' : pick(['PENDING', 'APPROVED', 'REFUSED'] as const)
    addRequest({
      employeeId: e.id, typeId: pick([1, 1, 2, 3]), startDate: isoDate(start), endDate: isoDate(addDays(start, days - 1)),
      days, state, reason: pick(['Family vacation', 'Medical appointment', 'Personal matter', 'Travel']),
      anomaly: null, decidedBy: state === 'PENDING' ? null : 'Morgan Diaz',
      decidedAt: state === 'PENDING' ? null : new Date(start.getTime() - 86400000).toISOString(), decisionNote: null,
    })
  }
}
/** B6 — Sam Patel's specific leave state. */
addRequest({
  employeeId: 5, typeId: 1, startDate: '2026-09-14', endDate: '2026-09-16', days: 3, state: 'NEEDS_ATTENTION',
  reason: 'Family vacation', anomaly: 'Annual Leave requires an approved allocation. Sam Patel has 0 approved days available.',
  decidedBy: null, decidedAt: null, decisionNote: null,
})
addRequest({
  employeeId: 5, typeId: 3, startDate: '2026-08-20', endDate: '2026-08-21', days: 2, state: 'PENDING',
  reason: 'Personal matter', anomaly: null, decidedBy: null, decidedAt: null, decisionNote: null,
})
for (const e of employees) e.counts.timeOffRequests = requests.filter((r) => r.employeeId === e.id).length

export function balancesFor(employeeId: number): LeaveBalance[] {
  return timeOffTypes.map((type) => {
    const allocated = allocations
      .filter((a) => a.employeeId === employeeId && a.typeId === type.id && a.state === 'APPROVED')
      .reduce((s, a) => s + a.days, 0)
    const taken = requests
      .filter((r) => r.employeeId === employeeId && r.typeId === type.id && r.state === 'APPROVED')
      .reduce((s, r) => s + r.days, 0)
    const pending = requests
      .filter((r) => r.employeeId === employeeId && r.typeId === type.id && (r.state === 'PENDING' || r.state === 'NEEDS_ATTENTION'))
      .reduce((s, r) => s + r.days, 0)
    const available = allocated - taken
    return { employeeId, typeId: type.id, typeName: type.name, allocated, taken, pending, available, projected: available - pending }
  })
}

/* --------------------------------------------------------------- payroll */

function computeLines(structure: SalaryStructure, wage: number, inputs: Record<string, number>): PayslipLine[] {
  const byCode: Record<string, number> = { WAGE: wage }
  const categories: Record<string, number> = { BASIC: 0, ALLOWANCE: 0, GROSS: 0, DEDUCTION: 0, NET: 0 }
  const lines: PayslipLine[] = []
  for (const r of [...structure.rules].sort((a, b) => a.sequence - b.sequence)) {
    let amount = 0
    if (r.computeType === 'FIXED') amount = r.fixedAmount ?? 0
    else if (r.computeType === 'PERCENTAGE') amount = ((byCode[r.baseRuleCode ?? 'WAGE'] ?? 0) * (r.percentage ?? 0)) / 100
    else if (r.code === 'GROSS') amount = categories.BASIC + categories.ALLOWANCE
    else if (r.code === 'NET') amount = categories.GROSS - categories.DEDUCTION
    else if (r.code === 'BONUS') amount = inputs.BONUS ?? 0
    amount = Math.round(amount)
    byCode[r.code] = amount
    if (r.category === 'DEDUCTION') categories.DEDUCTION += amount
    else if (r.category === 'ALLOWANCE') categories.ALLOWANCE += amount
    else if (r.category === 'BASIC') categories.BASIC += amount
    else if (r.category === 'GROSS') categories.GROSS = amount
    else categories.NET = amount
    lines.push({ ruleCode: r.code, ruleName: r.name, category: r.category, sequence: r.sequence, amount: r.category === 'DEDUCTION' ? -amount : amount })
  }
  return lines
}

export const PERIODS = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']
let payrunId = 0
let payslipId = 0
let issueId = 0
export const payruns: Payrun[] = []
export const payslips: Payslip[] = []
export const issues: PayrunIssue[] = []

function buildPayrun(period: string, state: Payrun['state']) {
  const { start, end } = monthRange(period)
  const structure = structures[0]
  const eligible = employees.filter((e) => activeContract(e.id, start) && structureFor(e).id === structure.id)
  const run: Payrun = {
    id: ++payrunId, name: `${new Date(`${period}-01T00:00:00`).toLocaleString('en-GB', { month: 'long', year: 'numeric' })}`,
    structureId: structure.id, structureName: structure.name, periodStart: start, periodEnd: end, state,
    employeeCount: eligible.length, payslipCount: 0, totalNet: 0, totalGross: 0, blockerCount: 0, warningCount: 0,
    createdBy: 'Jordan Lee', createdAt: `${start}T04:00:00Z`,
    computedAt: state === 'DRAFT' ? null : `${start}T05:00:00Z`,
    validatedAt: ['VALIDATED', 'PAID', 'SENT'].includes(state) ? `${end}T06:00:00Z` : null,
    paidAt: ['PAID', 'SENT'].includes(state) ? `${end}T09:00:00Z` : null,
    sentAt: state === 'SENT' ? `${end}T09:30:00Z` : null,
  }
  payruns.push(run)
  if (state === 'DRAFT') return run

  for (const e of eligible) {
    const contract = activeContract(e.id, start)!
    const inputs: Record<string, number> = rnd() > 0.88 ? { BONUS: between(2, 10) * 1000 } : {}
    const lines = computeLines(structure, contract.wage ?? 0, inputs)
    const basic = lines.filter((l) => l.category === 'BASIC').reduce((s, l) => s + l.amount, 0)
    const allowances = lines.filter((l) => l.category === 'ALLOWANCE').reduce((s, l) => s + l.amount, 0)
    const deductions = Math.abs(lines.filter((l) => l.category === 'DEDUCTION').reduce((s, l) => s + l.amount, 0))
    const gross = lines.find((l) => l.ruleCode === 'GROSS')?.amount ?? 0
    const net = lines.find((l) => l.ruleCode === 'NET')?.amount ?? 0
    const scheduledDays = 22
    const unpaidDays = rnd() > 0.93 ? between(1, 2) : 0
    const delivered = state === 'SENT'
    payslips.push({
      id: ++payslipId, payrunId: run.id, payrunName: run.name, payrunState: state, employeeId: e.id,
      employeeName: e.displayName, employeeNo: e.employeeNo, departmentName: e.departmentName,
      contractId: contract.id, contractReference: contract.reference, periodStart: start, periodEnd: end,
      workedDays: scheduledDays - unpaidDays, scheduledDays, unpaidDays, basic, allowances, deductions, gross, net,
      note: null, lines,
      inputs: Object.entries(inputs).map(([code, value]) => ({ code, value, source: 'MANUAL' })),
      delivery: {
        status: !e.bankAccount ? 'SKIPPED_NO_RECIPIENT' : delivered ? 'SENT' : 'NOT_SENT',
        sentAt: delivered && e.bankAccount ? run.sentAt : null,
        recipient: e.workEmail,
      },
    })
    run.totalNet += net
    run.totalGross += gross
  }
  run.payslipCount = payslips.filter((p) => p.payrunId === run.id).length

  if (state === 'COMPUTED') {
    const noBank = employees.filter((e) => !e.bankAccount && eligible.includes(e)).slice(0, 2)
    for (const e of noBank) {
      issues.push({
        id: ++issueId, payrunId: run.id, employeeId: e.id, employeeName: e.displayName, checkCode: 'MISSING_BANK_ACCOUNT',
        severity: 'BLOCKER', overridable: false, message: `${e.displayName} has no bank account on file.`,
        status: 'OPEN', overrideReason: null, fixLink: `/employees/${e.id}`,
      })
    }
    const noContract = employees.find((e) => e.id === EMPLOYEE_WITHOUT_CONTRACT)!
    issues.push({
      id: ++issueId, payrunId: run.id, employeeId: noContract.id, employeeName: noContract.displayName,
      checkCode: 'NO_ACTIVE_CONTRACT', severity: 'WARNING', overridable: true,
      message: `${noContract.displayName} has no contract valid for this period and was excluded.`,
      status: 'OPEN', overrideReason: null, fixLink: `/contracts?employeeId=${noContract.id}`,
    })
    for (const e of eligible.slice(0, 3)) {
      issues.push({
        id: ++issueId, payrunId: run.id, employeeId: e.id, employeeName: e.displayName, checkCode: 'UNAPPROVED_LEAVE',
        severity: 'WARNING', overridable: true, message: `${e.displayName} has a pending time-off request inside this period.`,
        status: 'OPEN', overrideReason: null, fixLink: `/timeoff?employeeId=${e.id}`,
      })
    }
  }
  run.blockerCount = issues.filter((i) => i.payrunId === run.id && i.severity === 'BLOCKER' && i.status === 'OPEN').length
  run.warningCount = issues.filter((i) => i.payrunId === run.id && i.severity === 'WARNING' && i.status === 'OPEN').length
  return run
}

buildPayrun('2026-04', 'SENT')
buildPayrun('2026-05', 'SENT')
buildPayrun('2026-06', 'SENT')
buildPayrun('2026-07', 'PAID')
buildPayrun('2026-08', 'VALIDATED')
buildPayrun('2026-09', 'COMPUTED')

export function eligibilityFor(structureId: number, periodStart: string): EligibleEmployee[] {
  return employees.map((e) => {
    const contract = activeContract(e.id, periodStart)
    const structureMatches = contract?.salaryStructureId === structureId
    return {
      employeeId: e.id, employeeNo: e.employeeNo, displayName: e.displayName, departmentName: e.departmentName,
      contractReference: contract?.reference ?? null, contractStructureName: contract?.salaryStructureName ?? null,
      eligible: Boolean(contract) && structureMatches,
      reason: !contract ? 'No contract valid in this period' : !structureMatches ? 'Contract uses a different salary structure' : null,
    }
  })
}

/* ----------------------------------------------------------- identity */

export interface DemoAccount { id: number; email: string; password: string; displayName: string; roleCode: RoleCode; employeeId: number }

export const demoAccounts: DemoAccount[] = [
  { id: 1, email: 'admin@peoplepay.local', password: 'Admin@12345', displayName: 'Taylor Brooks', roleCode: 'ADMIN', employeeId: 1 },
  { id: 2, email: 'hr@peoplepay.local', password: 'Hr@12345', displayName: 'Morgan Diaz', roleCode: 'HR_MANAGER', employeeId: 2 },
  { id: 3, email: 'payroll@peoplepay.local', password: 'Payroll@12345', displayName: 'Jordan Lee', roleCode: 'HR_PAYROLL_USER', employeeId: 3 },
  { id: 4, email: 'payroll.manager@peoplepay.local', password: 'Manager@12345', displayName: 'Riley Chen', roleCode: 'HR_PAYROLL_MANAGER', employeeId: 4 },
  { id: 5, email: 'employee@peoplepay.local', password: 'Employee@12345', displayName: 'Sam Patel', roleCode: 'EMPLOYEE', employeeId: 5 },
]

let grantId = 0
export const grants: Grant[] = [
  {
    id: ++grantId, userId: 5, permissionCode: 'chat.access', effect: 'ALLOW', reason: 'assistant pilot',
    grantedBy: 1, grantedByName: 'Taylor Brooks', grantedAt: '2026-08-20T06:00:00Z',
    expiresAt: '2026-09-19T06:00:00Z', revokedAt: null, active: true,
  },
]

export const adminUsers: AdminUser[] = demoAccounts.map((a) => ({
  id: a.id, email: a.email, displayName: a.displayName, roleCode: a.roleCode, employeeId: a.employeeId,
  active: true, employeeName: a.displayName,
  grantCount: grants.filter((g) => g.userId === a.id && g.active).length,
  lastActiveAt: `2026-09-0${a.id}T08:12:00Z`,
}))

export function permissionsFor(userId: number, roleCode: RoleCode) {
  return Array.from(effectivePermissions(roleCode, grants.filter((g) => g.userId === userId))).sort()
}

let auditId = 0
const AUDIT_ACTIONS: [string, string, AuditEvent['outcome'], AuditEvent['channel']][] = [
  ['LOGIN', 'AppUser', 'ALLOW', 'UI'],
  ['PAYRUN_COMPUTE', 'Payrun', 'ALLOW', 'UI'],
  ['PAYRUN_VALIDATE', 'Payrun', 'ALLOW', 'UI'],
  ['PAYRUN_PAY', 'Payrun', 'ALLOW', 'UI'],
  ['READ_SENSITIVE', 'Employee', 'ALLOW', 'UI'],
  ['TIMEOFF_APPROVE', 'TimeOffRequest', 'ALLOW', 'UI'],
  ['ATTENDANCE_UPDATE', 'Attendance', 'ALLOW', 'UI'],
  ['PERMISSION_GRANT', 'AppUser', 'ALLOW', 'UI'],
  ['EMPLOYEE_READ', 'Employee', 'DENY', 'CHAT'],
  ['PAYSLIP_READ', 'Payslip', 'DENY', 'MCP'],
]
export const auditEvents: AuditEvent[] = Array.from({ length: 120 }, (_, i) => {
  const [action, resourceType, outcome, channel] = AUDIT_ACTIONS[i % AUDIT_ACTIONS.length]
  const actor = demoAccounts[i % demoAccounts.length]
  return {
    id: ++auditId,
    occurredAt: new Date(TODAY.getTime() - i * 3.4e6).toISOString(),
    actorUserId: actor.id, actorName: actor.displayName, actorRoles: actor.roleCode, channel, action,
    resourceType, resourceId: String(between(1, 60)), outcome,
    reason: outcome === 'DENY' ? 'Caller lacks the required permission' : null,
    beforeJson: action.includes('UPDATE') ? '{"checkOut":null}' : null,
    afterJson: action.includes('UPDATE') ? '{"checkOut":"2026-09-01T12:30:00Z"}' : null,
    requestId: `req-${(1000 + i).toString(16)}`,
  }
})

export const aiProfiles: AiProfile[] = [
  {
    id: 1, name: 'Local Ollama', provider: 'OLLAMA', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1:8b',
    apiKeySet: false, apiKeyLast4: null, toolMode: 'AUTO', temperature: 0.2, maxTokens: 2048, isDefault: true,
    updatedAt: '2026-09-01T10:00:00Z', lastTestOk: true, lastTestAt: '2026-09-04T11:02:00Z', lastTestMessage: 'Connected in 412 ms',
  },
  {
    id: 2, name: 'OpenRouter fallback', provider: 'OPENROUTER', baseUrl: 'https://openrouter.ai/api/v1',
    model: 'meta-llama/llama-3.1-70b-instruct', apiKeySet: true, apiKeyLast4: '4f2a', toolMode: 'NATIVE',
    temperature: 0.3, maxTokens: 4096, isDefault: false, updatedAt: '2026-08-28T09:00:00Z',
    lastTestOk: null, lastTestAt: null, lastTestMessage: null,
  },
]

/* --------------------------------------------------------- dashboard */

export function buildDashboard(period: string, opts: { payroll: boolean; departmentId?: number | null; employeeType?: string | null }) {
  const { start, end } = monthRange(period)
  const scope = employees.filter(
    (e) => (!opts.departmentId || e.departmentId === opts.departmentId) && (!opts.employeeType || e.employeeType === opts.employeeType),
  )
  const scopeIds = new Set(scope.map((e) => e.id))
  const periodSlips = payslips.filter((p) => p.periodStart === start && scopeIds.has(p.employeeId))
  const periodAttendance = attendance.filter((a) => a.workDate >= start && a.workDate <= end && scopeIds.has(a.employeeId))

  const counts = {
    present: periodAttendance.filter((a) => a.status === 'PRESENT').length,
    late: periodAttendance.filter((a) => a.status === 'LATE').length,
    absent: periodAttendance.filter((a) => a.status === 'ABSENT').length,
    overtime: periodAttendance.filter((a) => a.status === 'OVERTIME').length,
    missingCheckouts: periodAttendance.filter((a) => a.status === 'MISSING_CHECKOUT').length,
    manualEdits: periodAttendance.filter((a) => a.isManualEdit).length,
  }
  const total = periodAttendance.length || 1
  const coveragePct = Math.round(((total - counts.absent - counts.missingCheckouts) / total) * 100)

  const approvedTimeOffDays = requests
    .filter((r) => r.state === 'APPROVED' && r.startDate >= start && r.startDate <= end && scopeIds.has(r.employeeId))
    .reduce((s, r) => s + r.days, 0)

  const byDepartment = departments
    .filter((d) => !opts.departmentId || d.id === opts.departmentId)
    .map((d) => {
      const ids = new Set(scope.filter((e) => e.departmentId === d.id).map((e) => e.id))
      return {
        departmentName: d.name,
        headcount: ids.size,
        amount: periodSlips.filter((p) => ids.has(p.employeeId)).reduce((s, p) => s + p.net, 0),
      }
    })

  const trend = PERIODS.map((p) => ({
    month: p,
    amount: payslips.filter((s) => s.periodStart === monthRange(p).start && scopeIds.has(s.employeeId)).reduce((s, x) => s + x.net, 0),
  }))

  const openIssues = issues.filter((i) => i.status === 'OPEN')
  const alerts: Dashboard['alerts'] = []
  const noBank = scope.filter((e) => !e.bankAccount).length
  if (noBank) alerts.push({ severity: 'BLOCKER', kind: 'PAYROLL', message: `${noBank} employees missing bank account`, link: '/employees' })
  const drafts = payruns.filter((p) => p.state === 'COMPUTED').length
  if (drafts) alerts.push({ severity: 'WARNING', kind: 'PAYROLL', message: `${drafts} payrun not validated`, link: '/payroll/payruns' })
  const needsAttention = requests.filter((r) => r.state === 'NEEDS_ATTENTION').length
  if (needsAttention) alerts.push({ severity: 'WARNING', kind: 'HR', message: `${needsAttention} time-off request needs attention`, link: '/timeoff' })
  if (openIssues.length) alerts.push({ severity: 'INFO', kind: 'PAYROLL', message: `${openIssues.length} open payroll issues in the current run`, link: '/payroll/payruns' })

  const base: Dashboard = {
    period,
    filters: { departmentId: opts.departmentId ?? null, employeeType: (opts.employeeType as any) ?? null },
    kpis: { approvedTimeOffDays, attendanceHealthPct: coveragePct },
    alerts,
    attendanceOverview: { ...counts, coveragePct },
    departments: byDepartment.map((d) => ({ departmentName: d.departmentName, headcount: d.headcount })),
  }

  if (!opts.payroll) return base

  const totalNetPaid = periodSlips.reduce((s, p) => s + p.net, 0)
  return {
    ...base,
    kpis: {
      ...base.kpis,
      totalNetPaid,
      payslipsGenerated: periodSlips.length,
      averageSalary: periodSlips.length ? Math.round(totalNetPaid / periodSlips.length) : 0,
      payslipsPaid: periodSlips.filter((p) => p.payrunState === 'PAID' || p.payrunState === 'SENT').length,
      payslipsPending: periodSlips.filter((p) => p.payrunState !== 'PAID' && p.payrunState !== 'SENT').length,
    },
    salaryCostByDepartment: byDepartment.map((d) => ({ departmentName: d.departmentName, amount: d.amount })),
    monthlyNetTrend: trend,
    departments: byDepartment.map((d) => ({ departmentName: d.departmentName, headcount: d.headcount, salarySpend: d.amount })),
  } as Dashboard
}

export function weeklyHoursOf(lines: { startTime: string; endTime: string; breakMinutes: number }[]) {
  return weeklyHours(lines)
}

/* --------------------------------------------------- payroll mutations */

export const payrunMembers = new Map<number, number[]>()
const payrunInputs = new Map<string, Record<string, number>>()
const inputKey = (payrunId: number, employeeId: number) => `${payrunId}:${employeeId}`

export function addInput(payrunId: number, employeeId: number, code: string, value: number) {
  const key = inputKey(payrunId, employeeId)
  payrunInputs.set(key, { ...(payrunInputs.get(key) ?? {}), [code]: value })
}

export function removePayslips(payrunId: number) {
  for (let i = payslips.length - 1; i >= 0; i--) if (payslips[i].payrunId === payrunId) payslips.splice(i, 1)
  for (let i = issues.length - 1; i >= 0; i--) if (issues[i].payrunId === payrunId) issues.splice(i, 1)
}

export function setPayslipState(run: Payrun) {
  for (const slip of payslips) if (slip.payrunId === run.id) slip.payrunState = run.state
}

export function refreshIssueCounts(payrunId: number) {
  const run = payruns.find((p) => p.id === payrunId)
  if (!run) return
  run.blockerCount = issues.filter((i) => i.payrunId === payrunId && i.severity === 'BLOCKER' && i.status === 'OPEN').length
  run.warningCount = issues.filter((i) => i.payrunId === payrunId && i.severity === 'WARNING' && i.status === 'OPEN').length
}

/** Recomputes every payslip in a payrun from the current structure, contracts and inputs. */
export function computePayrun(run: Payrun) {
  removePayslips(run.id)
  const structure = structures.find((s) => s.id === run.structureId)!
  const memberIds = payrunMembers.get(run.id) ?? employees.filter((e) => activeContract(e.id, run.periodStart)).map((e) => e.id)

  for (const employeeId of memberIds) {
    const employee = employees.find((e) => e.id === employeeId)
    if (!employee) continue
    const contract = activeContract(employeeId, run.periodStart)
    if (!contract) {
      issues.push({
        id: ++issueCounter, payrunId: run.id, employeeId, employeeName: employee.displayName,
        checkCode: 'NO_ACTIVE_CONTRACT', severity: 'BLOCKER', overridable: false,
        message: `${employee.displayName} has no contract valid for this period.`,
        status: 'OPEN', overrideReason: null, fixLink: `/contracts?employeeId=${employeeId}`,
      })
      continue
    }
    const inputs = payrunInputs.get(inputKey(run.id, employeeId)) ?? {}
    const lines = computeLines(structure, contract.wage ?? 0, inputs)
    const scheduledDays = 22
    const unpaidDays = inputs.UNPAID_DAYS ?? 0
    payslips.push({
      id: ++payslipCounter, payrunId: run.id, payrunName: run.name, payrunState: 'COMPUTED', employeeId,
      employeeName: employee.displayName, employeeNo: employee.employeeNo, departmentName: employee.departmentName,
      contractId: contract.id, contractReference: contract.reference, periodStart: run.periodStart, periodEnd: run.periodEnd,
      workedDays: scheduledDays - unpaidDays, scheduledDays, unpaidDays,
      basic: lines.filter((l) => l.category === 'BASIC').reduce((s, l) => s + l.amount, 0),
      allowances: lines.filter((l) => l.category === 'ALLOWANCE').reduce((s, l) => s + l.amount, 0),
      deductions: Math.abs(lines.filter((l) => l.category === 'DEDUCTION').reduce((s, l) => s + l.amount, 0)),
      gross: lines.find((l) => l.ruleCode === 'GROSS')?.amount ?? 0,
      net: lines.find((l) => l.ruleCode === 'NET')?.amount ?? 0,
      note: null, lines,
      inputs: Object.entries(inputs).map(([code, value]) => ({ code, value, source: 'MANUAL' })),
      delivery: { status: employee.workEmail ? 'NOT_SENT' : 'SKIPPED_NO_RECIPIENT', sentAt: null, recipient: employee.workEmail },
    })
    if (!employee.bankAccount) {
      issues.push({
        id: ++issueCounter, payrunId: run.id, employeeId, employeeName: employee.displayName,
        checkCode: 'MISSING_BANK_ACCOUNT', severity: 'BLOCKER', overridable: false,
        message: `${employee.displayName} has no bank account on file.`,
        status: 'OPEN', overrideReason: null, fixLink: `/employees/${employeeId}`,
      })
    }
    const pending = requests.some(
      (r) => r.employeeId === employeeId && (r.state === 'PENDING' || r.state === 'NEEDS_ATTENTION') &&
        r.startDate <= run.periodEnd && r.endDate >= run.periodStart,
    )
    if (pending) {
      issues.push({
        id: ++issueCounter, payrunId: run.id, employeeId, employeeName: employee.displayName,
        checkCode: 'UNAPPROVED_LEAVE', severity: 'WARNING', overridable: true,
        message: `${employee.displayName} has a pending time-off request inside this period.`,
        status: 'OPEN', overrideReason: null, fixLink: `/timeoff?employeeId=${employeeId}`,
      })
    }
  }

  const slips = payslips.filter((p) => p.payrunId === run.id)
  run.state = 'COMPUTED'
  run.computedAt = new Date().toISOString()
  run.payslipCount = slips.length
  run.employeeCount = memberIds.length
  run.totalNet = slips.reduce((s, p) => s + p.net, 0)
  run.totalGross = slips.reduce((s, p) => s + p.gross, 0)
  refreshIssueCounts(run.id)
}

let issueCounter = issues.reduce((m, i) => Math.max(m, i.id), 0)
let payslipCounter = payslips.reduce((m, p) => Math.max(m, p.id), 0)

const deliveryStarted = new Map<number, number>()
export function startDelivery(payrunId: number) {
  deliveryStarted.set(payrunId, Date.now())
}
/** Each poll moves a few queued payslips to SENT so the delivery panel animates. */
export function tickDelivery(payrunId: number) {
  const queued = payslips.filter((p) => p.payrunId === payrunId && p.delivery.status === 'QUEUED')
  for (const slip of queued.slice(0, Math.max(3, Math.ceil(queued.length / 3)))) {
    slip.delivery = { status: 'SENT', sentAt: new Date().toISOString(), recipient: slip.delivery.recipient }
  }
}

/** Minimal but valid single-page PDF so the download action produces a real file. */
export function payslipPdf(slip: Payslip) {
  const esc = (s: string) => s.replace(/[()\\]/g, '\\$&')
  const rows = slip.lines.map((l, i) => `BT /F1 10 Tf 60 ${600 - i * 16} Td (${esc(l.ruleName.padEnd(28))} ${esc(String(l.amount))}) Tj ET`).join('\n')
  const content = `BT /F1 18 Tf 60 720 Td (Payslip ${esc(slip.employeeName)}) Tj ET
BT /F1 11 Tf 60 700 Td (${esc(slip.employeeNo)} | ${esc(slip.periodStart)} to ${esc(slip.periodEnd)}) Tj ET
BT /F1 11 Tf 60 682 Td (Payrun: ${esc(slip.payrunName)}  Structure lines below) Tj ET
${rows}
BT /F1 13 Tf 60 ${580 - slip.lines.length * 16} Td (Net Salary: ${esc(String(slip.net))}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Blob([pdf], { type: 'application/pdf' })
}
