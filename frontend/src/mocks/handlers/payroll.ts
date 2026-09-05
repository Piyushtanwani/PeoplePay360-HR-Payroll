import { http, HttpResponse } from 'msw'
import * as db from '../data/seed'
import { guard, nextId, ok, page, problem } from '../helpers'
import type { Payrun, SalaryRule } from '@/api/types'

export const payrollHandlers = [
  /* ------------------------------------------------- salary structures */
  http.get('/api/salary-structures/names', ({ request }) =>
    guard(request, 'salary_structure.list_names', () => ok(db.structures.map((s) => ({ id: s.id, name: s.name })))),
  ),

  http.get('/api/salary-structures/formula-help', ({ request }) =>
    guard(request, 'salary_rule.read', () =>
      ok({
        variables: [
          { name: "categories['BASIC']", description: 'Sum of all basic-category rules computed so far' },
          { name: "categories['ALLOWANCE']", description: 'Sum of allowance rules computed so far' },
          { name: "categories['GROSS']", description: 'Gross salary once the gross rule has run' },
          { name: "categories['DEDUCTION']", description: 'Sum of deduction rules computed so far' },
          { name: 'contract.wage', description: 'Monthly wage on the applicable contract' },
          { name: 'worked_days', description: 'Days actually worked in the period' },
          { name: 'scheduled_days', description: 'Days the schedule expects in the period' },
          { name: "inputs['OVERTIME_HOURS']", description: 'Payrun input value for this employee' },
        ],
        functions: ['min(a, b)', 'max(a, b)', 'round(value, digits)', 'abs(value)'],
        example: "result = categories['BASIC'] * worked_days / scheduled_days",
      }),
    ),
  ),

  http.get('/api/salary-structures', ({ request }) =>
    guard(request, 'salary_structure.read', () => ok(page(db.structures, new URL(request.url)))),
  ),

  http.get('/api/salary-structures/:id', ({ request, params }) =>
    guard(request, 'salary_structure.read', () => {
      const structure = db.structures.find((s) => s.id === Number(params.id))
      return structure ? ok(structure) : problem(404, 'NOT_FOUND', 'Salary structure not found.')
    }),
  ),

  http.post('/api/salary-structures/:id/rules', ({ request, params }) =>
    guard(request, 'salary_rule.create', async () => {
      const structure = db.structures.find((s) => s.id === Number(params.id))
      if (!structure) return problem(404, 'NOT_FOUND', 'Salary structure not found.')
      const body = (await request.json()) as Partial<SalaryRule>
      if (structure.rules.some((r) => r.code === body.code)) {
        return problem(409, 'DUPLICATE', `Rule code ${body.code} already exists in this structure.`)
      }
      const rule: SalaryRule = {
        id: nextId(db.structures.flatMap((s) => s.rules)),
        structureId: structure.id,
        name: body.name ?? 'New rule',
        code: (body.code ?? 'NEW').toUpperCase(),
        category: body.category ?? 'ALLOWANCE',
        sequence: body.sequence ?? (structure.rules.length + 1) * 10,
        computeType: body.computeType ?? 'FIXED',
        fixedAmount: body.fixedAmount ?? null,
        percentage: body.percentage ?? null,
        baseRuleCode: body.baseRuleCode ?? null,
        formula: body.formula ?? null,
        active: true,
        description: body.description ?? null,
      }
      structure.rules.push(rule)
      structure.ruleCount = structure.rules.length
      return ok(rule, { status: 201 })
    }),
  ),

  http.put('/api/salary-structures/:id/rules/reorder', ({ request, params }) =>
    guard(request, 'salary_rule.update', async () => {
      const structure = db.structures.find((s) => s.id === Number(params.id))
      if (!structure) return problem(404, 'NOT_FOUND', 'Salary structure not found.')
      const { orderedRuleIds } = (await request.json()) as { orderedRuleIds: number[] }
      orderedRuleIds.forEach((id, index) => {
        const rule = structure.rules.find((r) => r.id === id)
        if (rule) rule.sequence = (index + 1) * 10
      })
      structure.rules.sort((a, b) => a.sequence - b.sequence)
      return ok(structure)
    }),
  ),

  http.put('/api/salary-structures/:id/rules/:ruleId', ({ request, params }) =>
    guard(request, 'salary_rule.update', async () => {
      const structure = db.structures.find((s) => s.id === Number(params.id))
      const rule = structure?.rules.find((r) => r.id === Number(params.ruleId))
      if (!rule) return problem(404, 'NOT_FOUND', 'Salary rule not found.')
      Object.assign(rule, await request.json())
      rule.code = rule.code.toUpperCase()
      structure!.rules.sort((a, b) => a.sequence - b.sequence)
      return ok(rule)
    }),
  ),

  http.delete('/api/salary-structures/:id/rules/:ruleId', ({ request, params }) =>
    guard(request, 'salary_rule.delete', () => {
      const structure = db.structures.find((s) => s.id === Number(params.id))
      if (!structure) return problem(404, 'NOT_FOUND', 'Salary structure not found.')
      const index = structure.rules.findIndex((r) => r.id === Number(params.ruleId))
      if (index < 0) return problem(404, 'NOT_FOUND', 'Salary rule not found.')
      structure.rules.splice(index, 1)
      structure.ruleCount = structure.rules.length
      return new Response(null, { status: 204 })
    }),
  ),

  http.post('/api/salary-structures/:id/dry-run', ({ request, params }) =>
    guard(request, 'salary_structure.dry_run', async () => {
      const structure = db.structures.find((s) => s.id === Number(params.id))
      if (!structure) return problem(404, 'NOT_FOUND', 'Salary structure not found.')
      const body = (await request.json()) as { employeeIds: number[]; period: string }
      const { start } = db.monthRange(body.period)
      const results = body.employeeIds.map((employeeId) => {
        const employee = db.employees.find((e) => e.id === employeeId)!
        const contract = db.activeContract(employeeId, start)
        const previous = db.payslips.find((p) => p.employeeId === employeeId && p.periodStart === start)
        const currentNet = previous?.net ?? 0
        const newNet = Math.round((contract?.wage ?? 0) * 1.36 - 3400)
        return { employeeId, employeeName: employee.displayName, currentNet, newNet, delta: newNet - currentNet, lines: previous?.lines ?? [] }
      })
      return ok({ results })
    }),
  ),

  /* ------------------------------------------------------------ payruns */
  http.get('/api/payruns', ({ request }) =>
    guard(request, 'payrun.read', () => {
      const url = new URL(request.url)
      const state = url.searchParams.get('state')
      const period = url.searchParams.get('period')
      let rows = [...db.payruns].sort((a, b) => b.periodStart.localeCompare(a.periodStart))
      if (state) rows = rows.filter((p) => p.state === state)
      if (period) rows = rows.filter((p) => p.periodStart.startsWith(period))
      return ok(page(rows, url))
    }),
  ),

  http.post('/api/payruns/eligibility', ({ request }) =>
    guard(request, 'payrun.create', async () => {
      const body = (await request.json()) as { structureId: number; periodStart: string }
      return ok(db.eligibilityFor(Number(body.structureId), body.periodStart))
    }),
  ),

  http.post('/api/payruns', ({ request }) =>
    guard(request, 'payrun.create', async (c) => {
      const body = (await request.json()) as { name?: string; structureId: number; periodStart: string; periodEnd: string; employeeIds: number[] }
      const structure = db.structures.find((s) => s.id === Number(body.structureId))
      if (!structure) return problem(400, 'VALIDATION_ERROR', 'Select a salary structure.')
      const run: Payrun = {
        id: nextId(db.payruns),
        name: body.name || new Date(`${body.periodStart}T00:00:00`).toLocaleString('en-GB', { month: 'long', year: 'numeric' }),
        structureId: structure.id, structureName: structure.name,
        periodStart: body.periodStart, periodEnd: body.periodEnd, state: 'DRAFT',
        employeeCount: body.employeeIds.length, payslipCount: 0, totalNet: 0, totalGross: 0,
        blockerCount: 0, warningCount: 0, createdBy: c.displayName, createdAt: new Date().toISOString(),
        computedAt: null, validatedAt: null, paidAt: null, sentAt: null,
      }
      db.payruns.push(run)
      db.payrunMembers.set(run.id, body.employeeIds)
      return ok(run, { status: 201 })
    }),
  ),

  http.get('/api/payruns/:id', ({ request, params }) =>
    guard(request, 'payrun.read', () => {
      const run = db.payruns.find((p) => p.id === Number(params.id))
      return run ? ok(run) : problem(404, 'NOT_FOUND', 'Payrun not found.')
    }),
  ),

  http.get('/api/payruns/:id/issues', ({ request, params }) =>
    guard(request, 'payrun.read', () => {
      const url = new URL(request.url)
      const severity = url.searchParams.get('severity')
      const status = url.searchParams.get('status')
      let rows = db.issues.filter((i) => i.payrunId === Number(params.id))
      if (severity) rows = rows.filter((i) => i.severity === severity)
      if (status) rows = rows.filter((i) => i.status === status)
      return ok(rows)
    }),
  ),

  http.post('/api/payruns/:id/issues/:issueId/override', ({ request, params }) =>
    guard(request, 'payrun.override_issue', async (c) => {
      const issue = db.issues.find((i) => i.id === Number(params.issueId))
      if (!issue) return problem(404, 'NOT_FOUND', 'Issue not found.')
      if (!issue.overridable) return problem(409, 'NOT_OVERRIDABLE', 'This check cannot be overridden. Fix the underlying data.')
      if (issue.employeeId === c.employeeId) return problem(403, 'SELF_ACTION', 'You cannot override an issue on your own payslip.')
      const body = (await request.json()) as { reason: string }
      issue.status = 'OVERRIDDEN'
      issue.overrideReason = body.reason
      db.refreshIssueCounts(issue.payrunId)
      return ok(issue)
    }),
  ),

  http.post('/api/payruns/:id/compute', ({ request, params }) =>
    guard(request, 'payrun.compute', () => {
      const run = db.payruns.find((p) => p.id === Number(params.id))
      if (!run) return problem(404, 'NOT_FOUND', 'Payrun not found.')
      if (run.state !== 'DRAFT' && run.state !== 'COMPUTED') return problem(409, 'ILLEGAL_STATE', 'Only draft or computed payruns can be computed.')
      db.computePayrun(run)
      return ok(run)
    }),
  ),

  http.post('/api/payruns/:id/validate', ({ request, params }) =>
    guard(request, 'payrun.validate', () => {
      const run = db.payruns.find((p) => p.id === Number(params.id))
      if (!run) return problem(404, 'NOT_FOUND', 'Payrun not found.')
      if (run.state !== 'COMPUTED') return problem(409, 'ILLEGAL_STATE', 'Compute the payrun before validating it.')
      const blockers = db.issues.filter((i) => i.payrunId === run.id && i.severity === 'BLOCKER' && i.status === 'OPEN')
      if (blockers.length) {
        return problem(409, 'BLOCKERS_PRESENT', `${blockers.length} blocking issue(s) must be resolved before validation.`, {
          blockers: blockers.map((b) => ({ id: b.id, message: b.message })),
        })
      }
      run.state = 'VALIDATED'
      run.validatedAt = new Date().toISOString()
      db.setPayslipState(run)
      return ok(run)
    }),
  ),

  http.post('/api/payruns/:id/pay', ({ request, params }) =>
    guard(request, 'payrun.pay', () => {
      const run = db.payruns.find((p) => p.id === Number(params.id))
      if (!run) return problem(404, 'NOT_FOUND', 'Payrun not found.')
      if (run.state !== 'VALIDATED') return problem(409, 'ILLEGAL_STATE', 'Only validated payruns can be marked paid.')
      run.state = 'PAID'
      run.paidAt = new Date().toISOString()
      db.setPayslipState(run)
      return ok(run)
    }),
  ),

  http.post('/api/payruns/:id/send', ({ request, params }) =>
    guard(request, 'payrun.send', () => {
      const run = db.payruns.find((p) => p.id === Number(params.id))
      if (!run) return problem(404, 'NOT_FOUND', 'Payrun not found.')
      if (run.state !== 'PAID' && run.state !== 'SENT') return problem(409, 'ILLEGAL_STATE', 'Mark the payrun as paid before sending payslips.')
      const slips = db.payslips.filter((p) => p.payrunId === run.id)
      let queued = 0
      let skipped = 0
      for (const slip of slips) {
        const employee = db.employees.find((e) => e.id === slip.employeeId)
        if (!employee?.workEmail) {
          slip.delivery = { status: 'SKIPPED_NO_RECIPIENT', sentAt: null, recipient: null }
          skipped += 1
        } else {
          slip.delivery = { status: 'QUEUED', sentAt: null, recipient: employee.workEmail }
          queued += 1
        }
      }
      run.state = 'SENT'
      run.sentAt = new Date().toISOString()
      db.setPayslipState(run)
      db.startDelivery(run.id)
      return ok({ queued, skipped }, { status: 202 })
    }),
  ),

  http.get('/api/payruns/:id/delivery', ({ request, params }) =>
    guard(request, 'payrun.read', () => {
      const slips = db.payslips.filter((p) => p.payrunId === Number(params.id))
      db.tickDelivery(Number(params.id))
      return ok({
        rows: slips.map((s) => ({ payslipId: s.id, employeeName: s.employeeName, ...s.delivery })),
        summary: {
          sent: slips.filter((s) => s.delivery.status === 'SENT').length,
          queued: slips.filter((s) => s.delivery.status === 'QUEUED').length,
          failed: slips.filter((s) => s.delivery.status === 'FAILED').length,
          skipped: slips.filter((s) => s.delivery.status === 'SKIPPED_NO_RECIPIENT').length,
        },
      })
    }),
  ),

  http.post('/api/payruns/:id/cancel', ({ request, params }) =>
    guard(request, 'payrun.delete', () => {
      const run = db.payruns.find((p) => p.id === Number(params.id))
      if (!run) return problem(404, 'NOT_FOUND', 'Payrun not found.')
      if (run.state !== 'DRAFT' && run.state !== 'COMPUTED') return problem(409, 'ILLEGAL_STATE', 'Only draft or computed payruns can be cancelled.')
      run.state = 'CANCELLED'
      db.removePayslips(run.id)
      return ok(run)
    }),
  ),

  http.post('/api/payruns/:id/inputs', ({ request, params }) =>
    guard(request, 'payrun.update', async () => {
      const run = db.payruns.find((p) => p.id === Number(params.id))
      if (!run) return problem(404, 'NOT_FOUND', 'Payrun not found.')
      const body = (await request.json()) as { employeeId: number; code: string; value: number }
      db.addInput(run.id, body.employeeId, body.code, Number(body.value))
      return ok({ ...body, source: 'MANUAL' }, { status: 201 })
    }),
  ),

  http.get('/api/payruns/:id/export.csv', ({ request, params }) =>
    guard(request, 'payrun.export', () => {
      const slips = db.payslips.filter((p) => p.payrunId === Number(params.id))
      const header = 'employeeNo,name,account,net\n'
      const body = slips
        .map((s) => {
          const employee = db.employees.find((e) => e.id === s.employeeId)
          return `${s.employeeNo},${s.employeeName},****${employee?.bankAccount?.accountLast4 ?? '0000'},${s.net}`
        })
        .join('\n')
      return new HttpResponse(header + body, {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="payrun_${params.id}.csv"` },
      })
    }),
  ),

  /* ----------------------------------------------------------- payslips */
  http.get('/api/payslips', ({ request }) =>
    guard(request, 'payslip.read.own', (c) => {
      const url = new URL(request.url)
      const seesAll = c.permissions.has('payslip.read.all')
      let rows = db.payslips.filter((p) => (seesAll ? true : p.employeeId === c.employeeId))
      const payrunId = url.searchParams.get('payrunId')
      const employeeId = url.searchParams.get('employeeId')
      const period = url.searchParams.get('period')
      if (payrunId) rows = rows.filter((p) => p.payrunId === Number(payrunId))
      if (employeeId) rows = rows.filter((p) => p.employeeId === Number(employeeId))
      if (period) rows = rows.filter((p) => p.periodStart.startsWith(period))
      return ok(page(rows, url))
    }),
  ),

  http.get('/api/payslips/:id', ({ request, params }) =>
    guard(request, 'payslip.read.own', (c) => {
      const slip = db.payslips.find((p) => p.id === Number(params.id))
      if (!slip) return problem(404, 'NOT_FOUND', 'Payslip not found.')
      if (!c.permissions.has('payslip.read.all') && slip.employeeId !== c.employeeId) {
        return problem(404, 'NOT_FOUND', 'Payslip not found.')
      }
      return ok(slip)
    }),
  ),

  http.get('/api/payslips/:id/variance', ({ request, params }) =>
    guard(request, 'payslip.read.all', () => {
      const slip = db.payslips.find((p) => p.id === Number(params.id))
      if (!slip) return problem(404, 'NOT_FOUND', 'Payslip not found.')
      const previous = db.payslips
        .filter((p) => p.employeeId === slip.employeeId && p.periodStart < slip.periodStart)
        .sort((a, b) => b.periodStart.localeCompare(a.periodStart))[0]
      if (!previous) return ok({ previousPayslipId: null, netDelta: 0, netDeltaPct: 0, lineDeltas: [] })
      return ok({
        previousPayslipId: previous.id,
        netDelta: slip.net - previous.net,
        netDeltaPct: previous.net ? Math.round(((slip.net - previous.net) / previous.net) * 1000) / 10 : 0,
        lineDeltas: slip.lines.map((line) => {
          const before = previous.lines.find((l) => l.ruleCode === line.ruleCode)?.amount ?? 0
          return { ruleCode: line.ruleCode, ruleName: line.ruleName, previous: before, current: line.amount, delta: line.amount - before }
        }),
      })
    }),
  ),

  http.put('/api/payslips/:id/note', ({ request, params }) =>
    guard(request, 'payslip.update.all', async (c) => {
      const slip = db.payslips.find((p) => p.id === Number(params.id))
      if (!slip) return problem(404, 'NOT_FOUND', 'Payslip not found.')
      if (slip.employeeId === c.employeeId) return problem(403, 'SELF_ACTION', 'You cannot edit your own payslip metadata.')
      const body = (await request.json()) as { note: string }
      slip.note = body.note
      return ok(slip)
    }),
  ),

  http.get('/api/payslips/:id/pdf', ({ request, params }) =>
    guard(request, 'payslip.read.own', () => {
      const slip = db.payslips.find((p) => p.id === Number(params.id))
      if (!slip) return problem(404, 'NOT_FOUND', 'Payslip not found.')
      const pdf = db.payslipPdf(slip)
      return new HttpResponse(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Payslip_${slip.employeeNo}_${slip.periodStart.slice(0, 7)}.pdf"`,
        },
      })
    }),
  ),

  /* ------------------------------------------------------------ reports */
  http.get('/api/reports/dashboard', ({ request }) =>
    guard(request, 'dashboard.read.hr', (c) => {
      const url = new URL(request.url)
      const period = url.searchParams.get('period') ?? '2026-09'
      const departmentId = url.searchParams.get('departmentId')
      const employeeType = url.searchParams.get('employeeType')
      const data = db.buildDashboard(period, {
        payroll: c.permissions.has('dashboard.read.payroll'),
        departmentId: departmentId ? Number(departmentId) : null,
        employeeType,
      })
      return ok(data, { headers: { ETag: `W/"${period}-${c.userId}-${db.payslips.length}"`, 'Cache-Control': 'private, max-age=0, must-revalidate' } })
    }),
  ),
]
