import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { useDepartments, useStructureNames } from '@/api/hooks'
import {
  Button, Callout, Card, CardHeader, Chip, DataTable, DateField, Field, MonthPicker, Select, Toggle, useToast,
} from '@/components/ui'
import { fmtPeriod } from '@/lib/format'
import type { EligibleEmployee, Payrun } from '@/api/types'

function monthBounds(period: string) {
  const [year, month] = period.split('-').map(Number)
  const end = new Date(year, month, 0)
  return { start: `${period}-01`, end: `${period}-${String(end.getDate()).padStart(2, '0')}` }
}

export function PayrunWizardPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const structures = useStructureNames()
  const departments = useDepartments()

  const [step, setStep] = React.useState<1 | 2>(1)
  const [structureId, setStructureId] = React.useState<number | null>(null)
  const [period, setPeriod] = React.useState('2026-09')
  const [customRange, setCustomRange] = React.useState(false)
  const [range, setRange] = React.useState(monthBounds('2026-09'))
  const [selected, setSelected] = React.useState<Set<number>>(new Set())
  const [departmentFilter, setDepartmentFilter] = React.useState<number | null>(null)

  React.useEffect(() => { if (!customRange) setRange(monthBounds(period)) }, [period, customRange])

  const structureName = structures.data?.find((s) => s.id === structureId)?.name ?? ''
  const autoName = `${fmtPeriod(period)}`

  const eligibility = useQuery({
    queryKey: ['payruns', 'eligibility', structureId, range.start],
    enabled: step === 2 && Boolean(structureId),
    queryFn: () => api.post<EligibleEmployee[]>('/api/payruns/eligibility', { structureId, periodStart: range.start, periodEnd: range.end }),
  })

  React.useEffect(() => {
    if (eligibility.data) setSelected(new Set(eligibility.data.filter((row) => row.eligible).map((row) => row.employeeId)))
  }, [eligibility.data])

  const create = useMutation({
    mutationFn: () =>
      api.post<Payrun>('/api/payruns', {
        name: autoName, structureId, periodStart: range.start, periodEnd: range.end, employeeIds: Array.from(selected),
      }),
    onSuccess: (payrun) => {
      toast.push({ tone: 'success', title: 'Payrun created', detail: `${payrun.name} · ${payrun.employeeCount} employees` })
      navigate(`/payroll/payruns/${payrun.id}`)
    },
    onError: (error) => toast.push({ tone: 'error', title: 'Could not create payrun', detail: error instanceof ApiError ? error.detail : '' }),
  })

  const rows = (eligibility.data ?? []).filter((row) => !departmentFilter || row.departmentName === departments.data?.find((d) => d.id === departmentFilter)?.name)
  const eligibleCount = rows.filter((r) => r.eligible).length

  return (
    <>
      <button onClick={() => navigate('/payroll/payruns')} className="mb-3 inline-flex items-center gap-1.5 text-sm2 text-label2 hover:text-label">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to payruns
      </button>

      <div className="mb-6 flex items-center gap-3">
        {[1, 2].map((n) => (
          <React.Fragment key={n}>
            <div className="flex items-center gap-2">
              <span className={`grid h-7 w-7 place-items-center rounded-full text-sm2 font-semibold ${step >= n ? 'bg-accent text-white' : 'bg-surface2 text-label2'}`}>
                {step > n ? <Check className="h-3.5 w-3.5" /> : n}
              </span>
              <span className={`text-sm2 font-medium ${step >= n ? 'text-label' : 'text-label2'}`}>{n === 1 ? 'Scope' : 'Employees'}</span>
            </div>
            {n === 1 ? <span className="h-px w-16 bg-separator" /> : null}
          </React.Fragment>
        ))}
      </div>

      {step === 1 ? (
        <Card className="max-w-2xl">
          <CardHeader title="New payrun — scope" subtitle="Continue moves to employee selection. Nothing is created yet." />
          <div className="space-y-4 p-5">
            <Field label="Salary structure" required hint="The structure determines which salary rules calculate every payslip.">
              <Select
                value={structureId}
                onChange={setStructureId}
                placeholder="Select a salary structure"
                options={(structures.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
              />
            </Field>

            <Field label="Period" required>
              <MonthPicker value={period} onChange={setPeriod} />
            </Field>

            <div className="flex items-center justify-between rounded-control bg-surface2 px-4 py-2.5">
              <span className="text-sm2 text-label2">Use a custom date range</span>
              <Toggle checked={customRange} onChange={setCustomRange} label="Custom range" />
            </div>

            {customRange ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Period start"><DateField value={range.start} onChange={(v) => setRange((r) => ({ ...r, start: v }))} /></Field>
                <Field label="Period end"><DateField value={range.end} min={range.start} onChange={(v) => setRange((r) => ({ ...r, end: v }))} /></Field>
              </div>
            ) : null}

            <Callout tone="accent" title="Payrun name">{autoName}</Callout>
          </div>
          <div className="flex justify-end gap-2 border-t border-separator px-5 py-3">
            <Button onClick={() => navigate('/payroll/payruns')}>Discard</Button>
            <Button variant="primary" disabled={!structureId} onClick={() => setStep(2)}>Continue</Button>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Select employee records"
            subtitle={`${structureName} · ${fmtPeriod(period)} — only the employees you select are included.`}
            action={
              <Select
                className="w-52"
                value={departmentFilter}
                onChange={setDepartmentFilter}
                clearable
                onClear={() => setDepartmentFilter(null)}
                placeholder="All departments"
                options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
              />
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-separator px-5 py-3">
            <span className="text-sm2 text-label2">
              <span className="tnum font-semibold text-label">{selected.size}</span> of {eligibleCount} eligible selected
            </span>
            <Button size="sm" onClick={() => setSelected(new Set(rows.filter((r) => r.eligible).map((r) => r.employeeId)))}>Select all eligible</Button>
          </div>
          <DataTable
            rows={rows.map((row) => ({ ...row, id: row.employeeId }))}
            loading={eligibility.isLoading}
            selectable
            selectedIds={selected}
            onSelectionChange={(ids) => setSelected(new Set(Array.from(ids).map(Number)))}
            rowDisabled={(row) => !row.eligible}
            columns={[
              { key: 'name', header: 'Employee', render: (r) => <span className="font-medium">{r.displayName}</span>, sortValue: (r) => r.displayName },
              { key: 'no', header: 'Employee no', render: (r) => <span className="tnum text-label2">{r.employeeNo}</span> },
              { key: 'department', header: 'Department', render: (r) => r.departmentName },
              { key: 'contract', header: 'Contract', render: (r) => r.contractReference ?? '—' },
              {
                key: 'structure', header: 'Structure',
                render: (r) => (r.contractStructureName === structureName ? r.contractStructureName : <Chip tone="warn">{r.contractStructureName ?? 'None'}</Chip>),
              },
              { key: 'reason', header: '', render: (r) => (r.reason ? <Chip tone="bad">{r.reason}</Chip> : null) },
            ]}
          />
          <div className="flex justify-end gap-2 border-t border-separator px-5 py-3">
            <Button onClick={() => setStep(1)}>Back</Button>
            <Button variant="primary" loading={create.isPending} disabled={selected.size === 0} onClick={() => create.mutate()}>
              Create payrun
            </Button>
          </div>
        </Card>
      )}
    </>
  )
}
