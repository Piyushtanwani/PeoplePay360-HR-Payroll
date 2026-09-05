import { http } from 'msw'
import * as db from '../data/seed'
import { guard, nextId, ok, page, problem } from '../helpers'
import type { Contract, Employee, WorkingSchedule } from '@/api/types'

export const peopleHandlers = [
  /* ------------------------------------------------------- departments */
  http.get('/api/departments', ({ request }) => guard(request, null, () => ok(db.departments))),

  /* --------------------------------------------------------- employees */
  http.get('/api/employees', ({ request }) =>
    guard(request, 'employee.read.all', () => {
      const url = new URL(request.url)
      const q = (url.searchParams.get('q') ?? '').toLowerCase()
      const departmentId = url.searchParams.get('departmentId')
      const employeeType = url.searchParams.get('employeeType')
      const active = url.searchParams.get('active')
      const rows = db.employees.filter((e) => {
        if (q && ![e.employeeNo, e.displayName, e.workEmail].some((v) => v.toLowerCase().includes(q))) return false
        if (departmentId && e.departmentId !== Number(departmentId)) return false
        if (employeeType && e.employeeType !== employeeType) return false
        if (active && String(e.active) !== active) return false
        return true
      })
      return ok(page(rows, url))
    }),
  ),

  http.get('/api/employees/:id', ({ request, params }) =>
    guard(request, 'employee.read.own', (c) => {
      const id = Number(params.id)
      if (!c.permissions.has('employee.read.all') && c.employeeId !== id) {
        return problem(404, 'NOT_FOUND', 'Employee not found.')
      }
      const employee = db.employees.find((e) => e.id === id)
      if (!employee) return problem(404, 'NOT_FOUND', 'Employee not found.')
      return ok(employee)
    }),
  ),

  http.post('/api/employees', ({ request }) =>
    guard(request, 'employee.create.all', async () => {
      const body = (await request.json()) as Partial<Employee>
      const department = db.departments.find((d) => d.id === Number(body.departmentId))
      const schedule = db.schedules.find((s) => s.id === Number(body.workingScheduleId))
      const id = nextId(db.employees)
      const employee: Employee = {
        id,
        employeeNo: `E-${1000 + id}`,
        displayName: body.displayName ?? 'New Employee',
        jobTitle: body.jobTitle ?? '',
        departmentId: department?.id ?? 1,
        departmentName: department?.name ?? 'Operations',
        employeeType: body.employeeType ?? 'FULL_TIME',
        managerId: body.managerId ?? null,
        managerName: db.employees.find((e) => e.id === body.managerId)?.displayName ?? null,
        roleCode: body.roleCode ?? null,
        onboarding: null,
        active: true,
        avatarColor: '#0A84FF',
        workEmail: body.workEmail ?? '',
        hireDate: body.hireDate ?? db.isoDate(db.TODAY),
        userId: null,
        workingScheduleId: schedule?.id ?? null,
        workingScheduleName: schedule?.name ?? null,
        activeContractId: null,
        bankAccount: null,
        counts: { contracts: 0, attendance: 0, timeOffRequests: 0, allocations: 0 },
      }
      db.employees.push(employee)
      const dept = db.departments.find((d) => d.id === employee.departmentId)
      if (dept) dept.employeeCount += 1
      return ok(employee, { status: 201 })
    }),
  ),

  http.put('/api/employees/:id', ({ request, params }) =>
    guard(request, 'employee.update.all', async () => {
      const employee = db.employees.find((e) => e.id === Number(params.id))
      if (!employee) return problem(404, 'NOT_FOUND', 'Employee not found.')
      const body = (await request.json()) as Partial<Employee>
      Object.assign(employee, body)
      const department = db.departments.find((d) => d.id === employee.departmentId)
      if (department) employee.departmentName = department.name
      const schedule = db.schedules.find((s) => s.id === employee.workingScheduleId)
      employee.workingScheduleName = schedule?.name ?? null
      return ok(employee)
    }),
  ),

  http.delete('/api/employees/:id', ({ request, params }) =>
    guard(request, 'employee.delete.all', () => {
      const employee = db.employees.find((e) => e.id === Number(params.id))
      if (!employee) return problem(404, 'NOT_FOUND', 'Employee not found.')
      employee.active = false
      return new Response(null, { status: 204 })
    }),
  ),

  http.get('/api/employees/:id/bank-account/unmask', ({ request, params }) =>
    guard(request, 'employee.read.sensitive', () => {
      const employee = db.employees.find((e) => e.id === Number(params.id))
      if (!employee?.bankAccount) return problem(404, 'NOT_FOUND', 'No bank account on file.')
      return ok({
        bankName: employee.bankAccount.bankName,
        accountNumber: `9${employee.id}00 4412 ${employee.bankAccount.accountLast4}`,
        ifsc: 'HDFC0001234',
      })
    }),
  ),

  http.put('/api/employees/:id/bank-account', ({ request, params }) =>
    guard(request, 'employee.update.all', async (c) => {
      const id = Number(params.id)
      if (c.employeeId === id) return problem(403, 'SELF_ACTION', 'You cannot edit your own bank account.')
      const employee = db.employees.find((e) => e.id === id)
      if (!employee) return problem(404, 'NOT_FOUND', 'Employee not found.')
      const body = (await request.json()) as { bankName: string; accountNumber: string }
      employee.bankAccount = { bankName: body.bankName, accountLast4: body.accountNumber.slice(-4), hasAccount: true }
      return ok(employee)
    }),
  ),

  /* --------------------------------------------------------- schedules */
  http.get('/api/schedules/names', ({ request }) =>
    guard(request, null, () => ok(db.schedules.map((s) => ({ id: s.id, name: s.name, weeklyHours: s.weeklyHours })))),
  ),

  http.get('/api/schedules', ({ request }) =>
    guard(request, 'schedule.read.all', () => ok(page(db.schedules, new URL(request.url)))),
  ),

  http.get('/api/schedules/:id', ({ request, params }) =>
    guard(request, 'schedule.read.all', () => {
      const schedule = db.schedules.find((s) => s.id === Number(params.id))
      return schedule ? ok(schedule) : problem(404, 'NOT_FOUND', 'Schedule not found.')
    }),
  ),

  http.post('/api/schedules', ({ request }) =>
    guard(request, 'schedule.create.all', async () => {
      const body = (await request.json()) as Partial<WorkingSchedule>
      const lines = body.lines ?? []
      const schedule: WorkingSchedule = {
        id: nextId(db.schedules),
        name: body.name ?? 'New schedule',
        type: body.type ?? 'FIXED',
        weeklyHours: db.weeklyHoursOf(lines),
        active: body.active ?? true,
        companyName: 'OXP Pvt Ltd',
        lines,
      }
      db.schedules.push(schedule)
      return ok(schedule, { status: 201 })
    }),
  ),

  http.put('/api/schedules/:id', ({ request, params }) =>
    guard(request, 'schedule.update.all', async () => {
      const schedule = db.schedules.find((s) => s.id === Number(params.id))
      if (!schedule) return problem(404, 'NOT_FOUND', 'Schedule not found.')
      const body = (await request.json()) as Partial<WorkingSchedule>
      Object.assign(schedule, body)
      schedule.weeklyHours = db.weeklyHoursOf(schedule.lines)
      return ok(schedule)
    }),
  ),

  http.delete('/api/schedules/:id', ({ request, params }) =>
    guard(request, 'schedule.delete.all', () => {
      const index = db.schedules.findIndex((s) => s.id === Number(params.id))
      if (index < 0) return problem(404, 'NOT_FOUND', 'Schedule not found.')
      db.schedules.splice(index, 1)
      return new Response(null, { status: 204 })
    }),
  ),

  /* --------------------------------------------------------- contracts */
  http.get('/api/contracts', ({ request }) =>
    guard(request, 'contract.read.own', (c) => {
      const url = new URL(request.url)
      const employeeId = url.searchParams.get('employeeId')
      const state = url.searchParams.get('state')
      const seesAll = c.permissions.has('contract.read.all')
      let rows = db.contracts.filter((x) => (seesAll ? true : x.employeeId === c.employeeId))
      if (employeeId) rows = rows.filter((x) => x.employeeId === Number(employeeId))
      if (state) rows = rows.filter((x) => x.state === state)
      const redacted = seesAll ? rows : rows.map((x) => ({ ...x, wage: null, wageType: null, salaryStructureId: null, salaryStructureName: null }))
      return ok(page(redacted, url))
    }),
  ),

  http.get('/api/contracts/:id', ({ request, params }) =>
    guard(request, 'contract.read.own', (c) => {
      const contract = db.contracts.find((x) => x.id === Number(params.id))
      if (!contract) return problem(404, 'NOT_FOUND', 'Contract not found.')
      const seesAll = c.permissions.has('contract.read.all')
      if (!seesAll && contract.employeeId !== c.employeeId) return problem(404, 'NOT_FOUND', 'Contract not found.')
      return ok(seesAll ? contract : { ...contract, wage: null, wageType: null, salaryStructureId: null, salaryStructureName: null })
    }),
  ),

  http.post('/api/contracts', ({ request }) =>
    guard(request, 'contract.create.all', async () => {
      const body = (await request.json()) as Partial<Contract>
      const employee = db.employees.find((e) => e.id === Number(body.employeeId))
      if (!employee) return problem(400, 'VALIDATION_ERROR', 'Select an employee.', { errors: [{ field: 'employeeId', message: 'required' }] })
      const overlap = db.contracts.find(
        (x) =>
          x.employeeId === employee.id &&
          (x.state === 'DRAFT' || x.state === 'RUNNING') &&
          (body.startDate ?? '') <= (x.endDate ?? '9999-12-31') &&
          (body.endDate ?? '9999-12-31') >= x.startDate,
      )
      if (overlap) {
        return problem(409, 'CONTRACT_OVERLAP', `This period overlaps contract ${overlap.reference}.`, { conflictingContractId: overlap.id })
      }
      const structure = db.structures.find((s) => s.id === Number(body.salaryStructureId))
      const schedule = db.schedules.find((s) => s.id === Number(body.workingScheduleId))
      const id = nextId(db.contracts)
      const contract: Contract = {
        id,
        employeeId: employee.id,
        employeeName: employee.displayName,
        reference: `C-${String(1000 + id).slice(1)}`,
        wage: Number(body.wage ?? 0),
        wageType: body.wageType ?? 'MONTHLY',
        startDate: body.startDate!,
        endDate: body.endDate ?? null,
        state: 'DRAFT',
        workingScheduleId: schedule?.id ?? null,
        workingScheduleName: schedule?.name ?? null,
        salaryStructureId: structure?.id ?? null,
        salaryStructureName: structure?.name ?? null,
        jobTitle: body.jobTitle ?? employee.jobTitle,
        departmentId: employee.departmentId,
        departmentName: employee.departmentName,
        isActiveNow: false,
        version: 1,
      }
      db.contracts.push(contract)
      employee.counts.contracts += 1
      return ok(contract, { status: 201 })
    }),
  ),

  http.put('/api/contracts/:id', ({ request, params }) =>
    guard(request, 'contract.update.all', async () => {
      const contract = db.contracts.find((x) => x.id === Number(params.id))
      if (!contract) return problem(404, 'NOT_FOUND', 'Contract not found.')
      if (contract.state !== 'DRAFT' && contract.state !== 'RUNNING') {
        return problem(409, 'ILLEGAL_STATE', 'Only draft or running contracts can be edited.')
      }
      Object.assign(contract, await request.json())
      contract.version += 1
      return ok(contract)
    }),
  ),

  http.post('/api/contracts/:id/activate', ({ request, params }) =>
    guard(request, 'contract.activate', () => {
      const contract = db.contracts.find((x) => x.id === Number(params.id))
      if (!contract) return problem(404, 'NOT_FOUND', 'Contract not found.')
      if (contract.state !== 'DRAFT') return problem(409, 'ILLEGAL_STATE', 'Only draft contracts can be activated.')
      contract.state = 'RUNNING'
      contract.isActiveNow = true
      const employee = db.employees.find((e) => e.id === contract.employeeId)
      if (employee) employee.activeContractId = contract.id
      return ok(contract)
    }),
  ),

  http.post('/api/contracts/:id/cancel', ({ request, params }) =>
    guard(request, 'contract.update.all', () => {
      const contract = db.contracts.find((x) => x.id === Number(params.id))
      if (!contract) return problem(404, 'NOT_FOUND', 'Contract not found.')
      contract.state = 'CANCELLED'
      contract.isActiveNow = false
      return ok(contract)
    }),
  ),

  http.delete('/api/contracts/:id', ({ request, params }) =>
    guard(request, 'contract.delete.all', () => {
      const index = db.contracts.findIndex((x) => x.id === Number(params.id))
      if (index < 0) return problem(404, 'NOT_FOUND', 'Contract not found.')
      if (db.contracts[index].state !== 'DRAFT') return problem(409, 'ILLEGAL_STATE', 'Only draft contracts can be deleted.')
      db.contracts.splice(index, 1)
      return new Response(null, { status: 204 })
    }),
  ),
]
