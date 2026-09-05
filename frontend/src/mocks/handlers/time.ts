import { http } from 'msw'
import * as db from '../data/seed'
import { guard, nextId, ok, page, problem } from '../helpers'
import type { Attendance, TimeOffAllocation, TimeOffRequest, TimeOffType } from '@/api/types'

function workingDaysBetween(start: string, end: string) {
  let days = 0
  const cursor = new Date(`${start}T00:00:00`)
  const last = new Date(`${end}T00:00:00`)
  while (cursor <= last) {
    const dow = cursor.getDay()
    const isHoliday = db.holidays.some((h) => h.date === db.isoDate(cursor))
    if (dow !== 0 && dow !== 6 && !isHoliday) days += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

export const timeHandlers = [
  /* -------------------------------------------------------- attendance */
  http.get('/api/attendance/today', ({ request }) =>
    guard(request, 'attendance.create.own', (c) => {
      const today = db.isoDate(db.TODAY)
      const todayRows = db.attendance.filter((a) => a.employeeId === c.employeeId && a.workDate === today)
      const openAttendance = todayRows.find((a) => a.checkIn && !a.checkOut) ?? null
      return ok({ openAttendance, todayRows })
    }),
  ),

  http.get('/api/attendance/exceptions', ({ request }) =>
    guard(request, 'attendance.read.all', () => {
      const url = new URL(request.url)
      const period = url.searchParams.get('period')
      const type = url.searchParams.get('type')
      const resolved = url.searchParams.get('resolved')
      let rows = db.exceptions
      if (period) rows = rows.filter((e) => e.date.startsWith(period))
      if (type) rows = rows.filter((e) => e.type === type)
      if (resolved !== null && resolved !== '') rows = rows.filter((e) => String(e.resolved) === resolved)
      return ok(page([...rows].reverse(), url))
    }),
  ),

  http.post('/api/attendance/exceptions/:id/resolve', ({ request, params }) =>
    guard(request, 'attendance.update.all', async () => {
      const exception = db.exceptions.find((e) => e.id === Number(params.id))
      if (!exception) return problem(404, 'NOT_FOUND', 'Exception not found.')
      const body = (await request.json()) as { checkOut?: string; reason: string }
      exception.resolved = true
      const row = db.attendance.find((a) => a.id === exception.attendanceId)
      if (row) {
        if (body.checkOut) row.checkOut = `${row.workDate}T${body.checkOut}:00.000Z`
        row.status = 'PRESENT'
        row.isManualEdit = true
        row.editReason = body.reason
      }
      return ok(exception)
    }),
  ),

  http.post('/api/attendance/recompute', ({ request }) =>
    guard(request, 'attendance.update.all', () => ok({ recomputed: db.attendance.length })),
  ),

  http.post('/api/attendance/check-in', ({ request }) =>
    guard(request, 'attendance.create.own', (c) => {
      const today = db.isoDate(db.TODAY)
      const open = db.attendance.find((a) => a.employeeId === c.employeeId && a.workDate === today && a.checkIn && !a.checkOut)
      if (open) return problem(409, 'ILLEGAL_STATE', 'You already have an open check-in.')
      const employee = db.employees.find((e) => e.id === c.employeeId)!
      const row: Attendance = {
        id: nextId(db.attendance), employeeId: c.employeeId, employeeName: employee.displayName, workDate: today,
        checkIn: new Date().toISOString(), checkOut: null, workedMinutes: 0, scheduledMinutes: 450,
        status: 'PRESENT', isManualEdit: false, editedBy: null, editReason: null,
      }
      db.attendance.push(row)
      return ok(row, { status: 201 })
    }),
  ),

  http.post('/api/attendance/check-out', ({ request }) =>
    guard(request, 'attendance.create.own', (c) => {
      const today = db.isoDate(db.TODAY)
      const open = db.attendance.find((a) => a.employeeId === c.employeeId && a.workDate === today && a.checkIn && !a.checkOut)
      if (!open) return problem(409, 'ILLEGAL_STATE', 'There is no open check-in to close.')
      open.checkOut = new Date().toISOString()
      open.workedMinutes = Math.round((new Date(open.checkOut).getTime() - new Date(open.checkIn!).getTime()) / 60000)
      return ok(open)
    }),
  ),

  http.get('/api/attendance', ({ request }) =>
    guard(request, 'attendance.read.own', (c) => {
      const url = new URL(request.url)
      const seesAll = c.permissions.has('attendance.read.all')
      const employeeId = url.searchParams.get('employeeId')
      if (!seesAll && employeeId && Number(employeeId) !== c.employeeId) {
        return problem(403, 'PERMISSION_DENIED', 'You may only view your own attendance.')
      }
      let rows = db.attendance.filter((a) => (seesAll ? true : a.employeeId === c.employeeId))
      if (employeeId) rows = rows.filter((a) => a.employeeId === Number(employeeId))
      const from = url.searchParams.get('from')
      const to = url.searchParams.get('to')
      const status = url.searchParams.get('status')
      const departmentId = url.searchParams.get('departmentId')
      if (from) rows = rows.filter((a) => a.workDate >= from)
      if (to) rows = rows.filter((a) => a.workDate <= to)
      if (status) rows = rows.filter((a) => a.status === status)
      if (departmentId) {
        const ids = new Set(db.employees.filter((e) => e.departmentId === Number(departmentId)).map((e) => e.id))
        rows = rows.filter((a) => ids.has(a.employeeId))
      }
      return ok(page([...rows].sort((a, b) => b.workDate.localeCompare(a.workDate)), url))
    }),
  ),

  http.put('/api/attendance/:id', ({ request, params }) =>
    guard(request, 'attendance.update.all', async (c) => {
      const row = db.attendance.find((a) => a.id === Number(params.id))
      if (!row) return problem(404, 'NOT_FOUND', 'Attendance row not found.')
      if (row.employeeId === c.employeeId) return problem(403, 'SELF_ACTION', 'You cannot correct your own attendance.')
      const body = (await request.json()) as { checkIn?: string; checkOut?: string; editReason: string }
      if (body.checkIn) row.checkIn = `${row.workDate}T${body.checkIn}:00.000Z`
      if (body.checkOut) row.checkOut = `${row.workDate}T${body.checkOut}:00.000Z`
      row.isManualEdit = true
      row.editedBy = c.displayName
      row.editReason = body.editReason
      if (row.checkIn && row.checkOut) {
        row.workedMinutes = Math.round((new Date(row.checkOut).getTime() - new Date(row.checkIn).getTime()) / 60000)
        row.status = 'PRESENT'
      }
      return ok(row)
    }),
  ),

  /* ---------------------------------------------------------- time off */
  http.get('/api/timeoff/types', ({ request }) => guard(request, 'timeoff_type.read', () => ok(db.timeOffTypes))),

  http.post('/api/timeoff/types', ({ request }) =>
    guard(request, 'timeoff_type.manage', async () => {
      const body = (await request.json()) as Partial<TimeOffType>
      const type: TimeOffType = {
        id: nextId(db.timeOffTypes), name: body.name ?? 'New type', code: body.code ?? 'NEW', unit: 'DAYS',
        isPaid: body.isPaid ?? true, requiresAllocation: body.requiresAllocation ?? false,
        color: body.color ?? '#0A84FF', active: true,
      }
      db.timeOffTypes.push(type)
      return ok(type, { status: 201 })
    }),
  ),

  http.put('/api/timeoff/types/:id', ({ request, params }) =>
    guard(request, 'timeoff_type.manage', async () => {
      const type = db.timeOffTypes.find((t) => t.id === Number(params.id))
      if (!type) return problem(404, 'NOT_FOUND', 'Type not found.')
      Object.assign(type, await request.json())
      return ok(type)
    }),
  ),

  http.get('/api/timeoff/holidays', ({ request }) => guard(request, 'timeoff_type.read', () => ok(db.holidays))),

  http.post('/api/timeoff/holidays', ({ request }) =>
    guard(request, 'timeoff_type.manage', async () => {
      const body = (await request.json()) as { name: string; date: string }
      const holiday = { id: nextId(db.holidays), ...body }
      db.holidays.push(holiday)
      return ok(holiday, { status: 201 })
    }),
  ),

  http.delete('/api/timeoff/holidays/:id', ({ request, params }) =>
    guard(request, 'timeoff_type.manage', () => {
      const index = db.holidays.findIndex((h) => h.id === Number(params.id))
      if (index >= 0) db.holidays.splice(index, 1)
      return new Response(null, { status: 204 })
    }),
  ),

  http.get('/api/timeoff/balances', ({ request }) =>
    guard(request, 'timeoff_allocation.read.own', (c) => {
      const url = new URL(request.url)
      const requested = url.searchParams.get('employeeId')
      const employeeId = requested ? Number(requested) : c.employeeId
      if (!c.permissions.has('timeoff_allocation.read.all') && employeeId !== c.employeeId) {
        return problem(404, 'NOT_FOUND', 'Employee not found.')
      }
      return ok(db.balancesFor(employeeId))
    }),
  ),

  http.get('/api/timeoff/allocations', ({ request }) =>
    guard(request, 'timeoff_allocation.read.own', (c) => {
      const url = new URL(request.url)
      const seesAll = c.permissions.has('timeoff_allocation.read.all')
      let rows = db.allocations.filter((a) => (seesAll ? true : a.employeeId === c.employeeId))
      const employeeId = url.searchParams.get('employeeId')
      const state = url.searchParams.get('state')
      if (employeeId) rows = rows.filter((a) => a.employeeId === Number(employeeId))
      if (state) rows = rows.filter((a) => a.state === state)
      return ok(page(rows, url))
    }),
  ),

  http.post('/api/timeoff/allocations', ({ request }) =>
    guard(request, 'timeoff_allocation.create.all', async () => {
      const body = (await request.json()) as Partial<TimeOffAllocation>
      const employee = db.employees.find((e) => e.id === Number(body.employeeId))
      const type = db.timeOffTypes.find((t) => t.id === Number(body.typeId))
      if (!employee || !type) return problem(400, 'VALIDATION_ERROR', 'Employee and time off type are required.')
      const allocation: TimeOffAllocation = {
        id: nextId(db.allocations), employeeId: employee.id, employeeName: employee.displayName,
        typeId: type.id, typeName: type.name, days: Number(body.days ?? 0),
        validFrom: body.validFrom ?? db.isoDate(db.TODAY), validTo: body.validTo ?? null,
        state: 'DRAFT', approvedBy: null, approvedAt: null, note: body.note ?? null,
      }
      db.allocations.push(allocation)
      return ok(allocation, { status: 201 })
    }),
  ),

  http.post('/api/timeoff/allocations/:id/approve', ({ request, params }) =>
    guard(request, 'timeoff_allocation.approve', (c) => {
      const allocation = db.allocations.find((a) => a.id === Number(params.id))
      if (!allocation) return problem(404, 'NOT_FOUND', 'Allocation not found.')
      if (allocation.employeeId === c.employeeId) return problem(403, 'SELF_ACTION', 'You cannot approve your own allocation.')
      allocation.state = 'APPROVED'
      allocation.approvedBy = c.displayName
      allocation.approvedAt = new Date().toISOString()
      // Re-evaluate requests that were short of balance.
      for (const r of db.requests.filter((r) => r.employeeId === allocation.employeeId && r.state === 'NEEDS_ATTENTION' && r.typeId === allocation.typeId)) {
        const balance = db.balancesFor(r.employeeId).find((b) => b.typeId === r.typeId)
        if (balance && balance.available >= r.days) {
          r.state = 'PENDING'
          r.anomaly = null
        }
      }
      return ok(allocation)
    }),
  ),

  http.post('/api/timeoff/allocations/:id/refuse', ({ request, params }) =>
    guard(request, 'timeoff_allocation.approve', (c) => {
      const allocation = db.allocations.find((a) => a.id === Number(params.id))
      if (!allocation) return problem(404, 'NOT_FOUND', 'Allocation not found.')
      if (allocation.employeeId === c.employeeId) return problem(403, 'SELF_ACTION', 'You cannot refuse your own allocation.')
      allocation.state = 'REFUSED'
      allocation.approvedBy = c.displayName
      allocation.approvedAt = new Date().toISOString()
      return ok(allocation)
    }),
  ),

  http.get('/api/timeoff/requests', ({ request }) =>
    guard(request, 'timeoff_request.read.own', (c) => {
      const url = new URL(request.url)
      const seesAll = c.permissions.has('timeoff_request.read.all')
      let rows = db.requests.filter((r) => (seesAll ? true : r.employeeId === c.employeeId))
      const employeeId = url.searchParams.get('employeeId')
      const state = url.searchParams.get('state')
      const departmentId = url.searchParams.get('departmentId')
      const typeId = url.searchParams.get('typeId')
      if (employeeId) rows = rows.filter((r) => r.employeeId === Number(employeeId))
      if (state) rows = rows.filter((r) => r.state === state)
      if (typeId) rows = rows.filter((r) => r.typeId === Number(typeId))
      if (departmentId) {
        const ids = new Set(db.employees.filter((e) => e.departmentId === Number(departmentId)).map((e) => e.id))
        rows = rows.filter((r) => ids.has(r.employeeId))
      }
      return ok(page([...rows].sort((a, b) => b.startDate.localeCompare(a.startDate)), url))
    }),
  ),

  http.post('/api/timeoff/requests/simulate', ({ request }) =>
    guard(request, 'timeoff_request.create.own', async (c) => {
      const body = (await request.json()) as { typeId: number; startDate: string; endDate: string; employeeId?: number }
      const employeeId = body.employeeId ?? c.employeeId
      const days = workingDaysBetween(body.startDate, body.endDate)
      const balance = db.balancesFor(employeeId).find((b) => b.typeId === Number(body.typeId))
      const type = db.timeOffTypes.find((t) => t.id === Number(body.typeId))
      const available = balance?.available ?? 0
      const anomaly =
        type?.requiresAllocation && available < days
          ? `${type.name} requires an approved allocation. Only ${available} day(s) available.`
          : null
      return ok({ days, available, projectedAfter: available - days, anomaly })
    }),
  ),

  http.post('/api/timeoff/requests', ({ request }) =>
    guard(request, 'timeoff_request.create.own', async (c) => {
      const body = (await request.json()) as Partial<TimeOffRequest>
      const employeeId = body.employeeId && c.permissions.has('timeoff_request.create.all') ? Number(body.employeeId) : c.employeeId
      const employee = db.employees.find((e) => e.id === employeeId)!
      const type = db.timeOffTypes.find((t) => t.id === Number(body.typeId))
      if (!type) return problem(400, 'VALIDATION_ERROR', 'Select a time off type.')
      const days = workingDaysBetween(body.startDate!, body.endDate!)
      const balance = db.balancesFor(employeeId).find((b) => b.typeId === type.id)
      const short = type.requiresAllocation && (balance?.available ?? 0) < days
      const row: TimeOffRequest = {
        id: nextId(db.requests), employeeId, employeeName: employee.displayName, typeId: type.id, typeName: type.name,
        startDate: body.startDate!, endDate: body.endDate!, days,
        state: short ? 'NEEDS_ATTENTION' : 'PENDING',
        reason: body.reason ?? null,
        anomaly: short ? `${type.name} requires an approved allocation. Only ${balance?.available ?? 0} day(s) available.` : null,
        decidedBy: null, decidedAt: null, decisionNote: null,
      }
      db.requests.push(row)
      return ok(row, { status: 201 })
    }),
  ),

  http.post('/api/timeoff/requests/:id/approve', ({ request, params }) =>
    guard(request, 'timeoff_request.approve', (c) => {
      const row = db.requests.find((r) => r.id === Number(params.id))
      if (!row) return problem(404, 'NOT_FOUND', 'Request not found.')
      if (row.employeeId === c.employeeId) return problem(403, 'SELF_ACTION', 'You cannot approve your own request.')
      if (row.state === 'NEEDS_ATTENTION') {
        return problem(409, 'ILLEGAL_STATE', 'This request has no allocation to consume. Approve an allocation first.')
      }
      row.state = 'APPROVED'
      row.decidedBy = c.displayName
      row.decidedAt = new Date().toISOString()
      return ok(row)
    }),
  ),

  http.post('/api/timeoff/requests/:id/refuse', ({ request, params }) =>
    guard(request, 'timeoff_request.approve', (c) => {
      const row = db.requests.find((r) => r.id === Number(params.id))
      if (!row) return problem(404, 'NOT_FOUND', 'Request not found.')
      if (row.employeeId === c.employeeId) return problem(403, 'SELF_ACTION', 'You cannot refuse your own request.')
      row.state = 'REFUSED'
      row.decidedBy = c.displayName
      row.decidedAt = new Date().toISOString()
      return ok(row)
    }),
  ),

  http.post('/api/timeoff/requests/:id/cancel', ({ request, params }) =>
    guard(request, 'timeoff_request.update.own', (c) => {
      const row = db.requests.find((r) => r.id === Number(params.id))
      if (!row) return problem(404, 'NOT_FOUND', 'Request not found.')
      if (row.employeeId !== c.employeeId && !c.permissions.has('timeoff_request.update.all')) {
        return problem(404, 'NOT_FOUND', 'Request not found.')
      }
      row.state = 'CANCELLED'
      return ok(row)
    }),
  ),
]
