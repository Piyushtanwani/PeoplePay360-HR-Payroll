import * as React from 'react'
import { useContractTemplateOptions, useEmployeeOptions, useScheduleNames, useStructureNames } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import { ApiError } from '@/api/client'
import {
  Button, Callout, DateField, DetailList, Field, MoneyInput, Select, Sheet, StatusBadge, TextInput,
} from '@/components/ui'
import { fmtDate, moneyExact } from '@/lib/format'
import { todayIso } from '@/lib/dates'
import type { Contract } from '@/api/types'

const WAGE_TYPES = [
  { value: 'MONTHLY', label: 'Monthly', description: 'A fixed amount each month.' },
  { value: 'HOURLY', label: 'Hourly', description: 'The rate itself; hours come from attendance.' },
]

/**
 * A contract, read or edited in the same panel.
 *
 * Contracts may not overlap for one person, so an overlap is shown against the dates that caused it
 * rather than as a passing message.
 */
export function ContractSheet({ open, onOpenChange, contract, employeeId, saving, error, onSubmit, footerActions }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract?: Contract | null
  employeeId?: number | null
  saving: boolean
  error?: unknown
  onSubmit: (body: Record<string, unknown>) => void
  footerActions?: React.ReactNode
}) {
  const { can } = useAuth()
  const editing = Boolean(contract)
  const employees = useEmployeeOptions(open && !editing)
  const schedules = useScheduleNames()
  const structures = useStructureNames(open && can('salary_structure.list_names'))
  const templates = useContractTemplateOptions(open && !editing)

  const [mode, setMode] = React.useState<'read' | 'form'>('read')
  const [form, setForm] = React.useState({
    employeeId: employeeId ?? null as number | null,
    wage: null as number | null,
    wageType: 'MONTHLY',
    startDate: todayIso(),
    endDate: '',
    workingScheduleId: null as number | null,
    salaryStructureId: null as number | null,
    jobTitle: '',
  })

  React.useEffect(() => {
    if (!open) return
    setMode(editing ? 'read' : 'form')
    setForm({
      employeeId: contract?.employeeId ?? employeeId ?? null,
      wage: contract?.wage ?? null,
      wageType: contract?.wageType ?? 'MONTHLY',
      startDate: contract?.startDate ?? todayIso(),
      endDate: contract?.endDate ?? '',
      workingScheduleId: contract?.workingScheduleId ?? null,
      salaryStructureId: contract?.salaryStructureId ?? null,
      jobTitle: contract?.jobTitle ?? '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contract?.id])

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const applyTemplate = (templateId: number | null) => {
    const template = templates.data?.content.find((t) => t.id === templateId)
    if (!template) return
    setForm((current) => ({
      ...current,
      wage: template.wage,
      wageType: template.wageType,
      workingScheduleId: template.workingScheduleId ?? current.workingScheduleId,
      salaryStructureId: template.salaryStructureId ?? current.salaryStructureId,
      jobTitle: template.jobTitle ?? current.jobTitle,
    }))
  }

  const overlap = error instanceof ApiError && error.code === 'CONTRACT_OVERLAP'
  const valid = form.employeeId && (form.wage ?? 0) > 0 && form.startDate

  const submit = () =>
    onSubmit({
      employeeId: form.employeeId,
      wage: form.wage,
      wageType: form.wageType,
      startDate: form.startDate,
      endDate: form.endDate || null,
      workingScheduleId: form.workingScheduleId,
      salaryStructureId: form.salaryStructureId,
      jobTitle: form.jobTitle || null,
    })

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      title={contract ? contract.reference : 'New contract'}
      description={
        mode === 'read'
          ? 'What payroll reads for this person during the period this contract covers.'
          : 'A person may hold only one contract on any given day, so the dates must not overlap another.'
      }
      footer={
        mode === 'read' ? (
          <>
            {footerActions}
            {can('contract.update.all') && contract && ['DRAFT', 'RUNNING'].includes(contract.state) ? (
              <Button onClick={() => setMode('form')}>Edit</Button>
            ) : null}
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </>
        ) : (
          <>
            <Button onClick={() => (editing ? setMode('read') : onOpenChange(false))}>Cancel</Button>
            <Button variant="primary" loading={saving} disabled={!valid} onClick={submit}>
              {editing ? 'Save changes' : 'Create contract'}
            </Button>
          </>
        )
      }
    >
      {mode === 'read' && contract ? (
        <div className="space-y-4">
          <DetailList
            items={[
              { label: 'Employee', value: contract.employeeName },
              { label: 'Status', value: <StatusBadge status={contract.state} /> },
              { label: 'Wage', value: contract.wage !== null ? moneyExact(contract.wage) : 'Not visible to your role', tnum: true },
              { label: 'Wage type', value: contract.wageType ?? '—' },
              { label: 'Started', value: fmtDate(contract.startDate) },
              { label: 'Ends', value: contract.endDate ? fmtDate(contract.endDate) : 'Open ended' },
              {
                label: 'Working schedule',
                value: contract.workingScheduleName ?? '—',
                hint: 'Sets how many days and hours the period expects.',
              },
              {
                label: 'Salary structure',
                value: contract.salaryStructureName ?? '—',
                hint: 'The set of rules payroll runs for this person.',
              },
              { label: 'Job title', value: contract.jobTitle || '—' },
            ]}
          />
          {contract.isActiveNow ? (
            <Callout tone="ok" title="In force today">
              This is the contract a payrun covering today would use.
            </Callout>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {overlap ? (
            <Callout tone="bad" title="These dates overlap an existing contract">
              {error instanceof ApiError ? error.detail : ''} End the current contract first, or start this one after it.
            </Callout>
          ) : null}

          {!editing ? (
            <>
              <Field label="Employee" required>
                <Select
                  value={form.employeeId}
                  onChange={(v) => set('employeeId', v)}
                  options={(employees.data?.content ?? []).map((e) => ({
                    value: e.id,
                    label: e.displayName,
                    description: `${e.employeeNo} · ${e.departmentName ?? 'no department'}`,
                  }))}
                  placeholder="Select employee"
                />
              </Field>
              <Field label="Fill from a template" hint="Optional shortcut. You can still change anything below.">
                <Select
                  value={null}
                  onChange={(v) => applyTemplate(v as number)}
                  options={(templates.data?.content ?? []).map((t) => ({
                    value: t.id,
                    label: t.name,
                    description: `${moneyExact(t.wage)} ${t.wageType.toLowerCase()}`,
                  }))}
                  placeholder="Choose a template"
                  emptyMessage="No templates yet. Create one on the Templates tab."
                />
              </Field>
            </>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Wage" required>
              <MoneyInput value={form.wage} onChange={(v) => set('wage', v)} />
            </Field>
            <Field label="Wage type" required>
              <Select value={form.wageType} onChange={(v) => set('wageType', v)} options={WAGE_TYPES} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date" required>
              <DateField value={form.startDate} onChange={(v) => set('startDate', v)} />
            </Field>
            <Field label="End date" hint="Leave empty for an open-ended contract.">
              <DateField value={form.endDate} min={form.startDate} onChange={(v) => set('endDate', v)} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Working schedule">
              <Select
                value={form.workingScheduleId}
                onChange={(v) => set('workingScheduleId', v)}
                options={(schedules.data ?? []).map((s) => ({
                  value: s.id,
                  label: s.name,
                  description: `${s.weeklyHours} hours a week`,
                }))}
                placeholder="Use the employee's schedule"
                clearable
                onClear={() => set('workingScheduleId', null)}
              />
            </Field>
            <Field label="Salary structure" hint="The rules payroll runs. Without one, this contract cannot be paid.">
              <Select
                value={form.salaryStructureId}
                onChange={(v) => set('salaryStructureId', v)}
                options={(structures.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
                placeholder="Select structure"
                clearable
                onClear={() => set('salaryStructureId', null)}
              />
            </Field>
          </div>

          <Field label="Job title on this contract">
            <TextInput value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} placeholder="Payroll Specialist" />
          </Field>
        </div>
      )}
    </Sheet>
  )
}
