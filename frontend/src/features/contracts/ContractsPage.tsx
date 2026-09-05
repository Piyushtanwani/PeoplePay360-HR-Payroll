import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { useEmployeeOptions, useScheduleNames, useStructureNames } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import {
  Button, Callout, Card, Chip, DataTable, DateField, Field, MoneyInput, PageHeader, SegmentedControl,
  Select, Sheet, StatusBadge, TextInput, useToast,
} from '@/components/ui'
import { fmtDate, money } from '@/lib/format'
import type { Contract, Page } from '@/api/types'

export function ContractsPage() {
  const { can } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [state, setState] = React.useState<string | null>(null)
  const [employeeId, setEmployeeId] = React.useState<number | null>(searchParams.get('employeeId') ? Number(searchParams.get('employeeId')) : null)
  const [open, setOpen] = React.useState<Contract | 'new' | null>(null)
  const [conflict, setConflict] = React.useState<{ message: string; id?: number } | null>(null)

  const canSeeAll = can('contract.read.all')
  const employees = useEmployeeOptions(canSeeAll)
  const schedules = useScheduleNames()
  const structures = useStructureNames(can('salary_structure.list_names'))

  const query = useQuery({
    queryKey: ['contracts', state, employeeId],
    queryFn: () => api.page<Contract>('/api/contracts', { state, employeeId, size: 200 }),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['contracts'] })
    queryClient.invalidateQueries({ queryKey: ['employees'] })
  }

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Contract>('/api/contracts', body),
    onSuccess: (contract) => {
      invalidate()
      setOpen(null)
      setConflict(null)
      toast.push({ tone: 'success', title: 'Contract created', detail: `${contract.reference} is in draft. Activate it to make it the running contract.` })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'CONTRACT_OVERLAP') {
        setConflict({ message: error.detail, id: (error as unknown as { conflictingContractId?: number }).conflictingContractId })
        return
      }
      toast.push({ tone: 'error', title: 'Could not create contract', detail: error instanceof ApiError ? error.detail : '' })
    },
  })

  const activate = useMutation({
    mutationFn: (id: number) => api.post<Contract>(`/api/contracts/${id}/activate`),
    onSuccess: () => { invalidate(); setOpen(null); toast.push({ tone: 'success', title: 'Contract activated' }) },
    onError: (error) => toast.push({ tone: 'error', title: 'Could not activate', detail: error instanceof ApiError ? error.detail : '' }),
  })

  const cancel = useMutation({
    mutationFn: (id: number) => api.post<Contract>(`/api/contracts/${id}/cancel`),
    onSuccess: () => { invalidate(); setOpen(null); toast.push({ tone: 'info', title: 'Contract cancelled' }) },
  })

  return (
    <>
      <PageHeader
        title="Contracts"
        description="History is retained, but only one contract may be running for a period — payroll depends on it."
        actions={can('contract.create.all') ? <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => { setConflict(null); setOpen('new') }}>New contract</Button> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SegmentedControl
          value={state ?? 'ALL'}
          onChange={(value) => setState(value === 'ALL' ? null : value)}
          options={[
            { value: 'ALL', label: 'All' },
            { value: 'DRAFT', label: 'Draft' },
            { value: 'RUNNING', label: 'Running' },
            { value: 'EXPIRED', label: 'Expired' },
            { value: 'CANCELLED', label: 'Cancelled' },
          ]}
        />
        {canSeeAll ? (
          <Select
            className="w-64"
            value={employeeId}
            onChange={setEmployeeId}
            clearable
            onClear={() => setEmployeeId(null)}
            placeholder="All employees"
            options={(employees.data?.content ?? []).map((e) => ({ value: e.id, label: e.displayName, description: e.employeeNo }))}
          />
        ) : null}
        <span className="text-sm2 text-label2">{query.data?.totalElements ?? 0} contracts</span>
      </div>

      <Card>
        <DataTable
          rows={query.data?.content ?? []}
          loading={query.isLoading}
          onRowClick={(row) => setOpen(row)}
          columns={[
            { key: 'ref', header: 'Contract', render: (r) => <span className="tnum font-medium">{r.reference}</span>, sortValue: (r) => r.reference },
            { key: 'employee', header: 'Employee', render: (r) => <Link to={`/employees/${r.employeeId}`} className="hover:text-accent" onClick={(e) => e.stopPropagation()}>{r.employeeName}</Link>, sortValue: (r) => r.employeeName },
            { key: 'start', header: 'Start', render: (r) => fmtDate(r.startDate), sortValue: (r) => r.startDate },
            { key: 'end', header: 'End', render: (r) => (r.endDate ? fmtDate(r.endDate) : '—') },
            ...(canSeeAll ? [{ key: 'wage', header: 'Wage / month', align: 'right' as const, render: (r: Contract) => money(r.wage), sortValue: (r: Contract) => r.wage ?? 0 }] : []),
            { key: 'schedule', header: 'Schedule', render: (r) => r.workingScheduleName ?? '—' },
            ...(canSeeAll ? [{ key: 'structure', header: 'Structure', render: (r: Contract) => r.salaryStructureName ?? '—' }] : []),
            { key: 'state', header: 'Status', render: (r) => <div className="flex items-center gap-1.5"><StatusBadge status={r.state} />{r.isActiveNow ? <Chip tone="ok">Active now</Chip> : null}</div> },
          ]}
        />
      </Card>

      <ContractSheet
        contract={open}
        onOpenChange={(next) => { if (!next) { setOpen(null); setConflict(null) } }}
        conflict={conflict}
        saving={create.isPending || activate.isPending}
        canEdit={can('contract.create.all')}
        canActivate={can('contract.activate')}
        employees={(employees.data?.content ?? []).map((e) => ({ value: e.id, label: e.displayName, description: `${e.employeeNo} · ${e.departmentName}` }))}
        schedules={(schedules.data ?? []).map((s) => ({ value: s.id, label: s.name, description: `${s.weeklyHours}h per week` }))}
        structures={(structures.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
        onCreate={(body) => create.mutate(body)}
        onActivate={(id) => activate.mutate(id)}
        onCancel={(id) => cancel.mutate(id)}
      />
    </>
  )
}

function ContractSheet({ contract, onOpenChange, employees, schedules, structures, onCreate, onActivate, onCancel, conflict, saving, canEdit, canActivate }: {
  contract: Contract | 'new' | null
  onOpenChange: (open: boolean) => void
  employees: { value: number; label: string; description?: string }[]
  schedules: { value: number; label: string; description?: string }[]
  structures: { value: number; label: string }[]
  onCreate: (body: Record<string, unknown>) => void
  onActivate: (id: number) => void
  onCancel: (id: number) => void
  conflict: { message: string; id?: number } | null
  saving: boolean
  canEdit: boolean
  canActivate: boolean
}) {
  const isNew = contract === 'new'
  const [form, setForm] = React.useState({
    employeeId: null as number | null, wage: 55000, wageType: 'MONTHLY', startDate: '2026-10-01',
    endDate: '', workingScheduleId: null as number | null, salaryStructureId: null as number | null, jobTitle: '',
  })
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  React.useEffect(() => { if (isNew) setForm((f) => ({ ...f, employeeId: null })) }, [isNew])

  if (!contract) return null

  if (!isNew) {
    const row = contract
    return (
      <Sheet
        open
        onOpenChange={onOpenChange}
        title={`Contract ${row.reference}`}
        description={`${row.employeeName} · ${row.departmentName}`}
        footer={
          <>
            {row.state === 'DRAFT' && canActivate ? <Button variant="primary" onClick={() => onActivate(row.id)} loading={saving}>Activate contract</Button> : null}
            {(row.state === 'DRAFT' || row.state === 'RUNNING') && canEdit ? <Button variant="danger" onClick={() => onCancel(row.id)}>Cancel contract</Button> : null}
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </>
        }
      >
        <dl className="divide-y divide-separator rounded-card border border-separator">
          {[
            ['Employee', row.employeeName],
            ['Job position', row.jobTitle],
            ['Department', row.departmentName],
            ['Start date', fmtDate(row.startDate)],
            ['End date', row.endDate ? fmtDate(row.endDate) : 'Open ended'],
            ['Wage / month', money(row.wage)],
            ['Working schedule', row.workingScheduleName ?? '—'],
            ['Salary structure', row.salaryStructureName ?? '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 px-4 py-2.5 text-sm2">
              <dt className="text-label2">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 px-4 py-2.5 text-sm2">
            <dt className="text-label2">Status</dt>
            <dd><StatusBadge status={row.state} /></dd>
          </div>
        </dl>
        <p className="mt-4 text-xs2 text-label2">
          This running contract is the source for payroll calculation in the active period.
        </p>
      </Sheet>
    )
  }

  const valid = form.employeeId && form.startDate && form.wage > 0

  return (
    <Sheet
      open
      onOpenChange={onOpenChange}
      title="New contract"
      description="A new contract starts in draft. Activate it to make it the running contract."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={!valid} loading={saving} onClick={() => onCreate({ ...form, endDate: form.endDate || null })}>Create contract</Button>
        </>
      }
    >
      <div className="space-y-4">
        {conflict ? (
          <Callout tone="bad" title="Contract period overlaps">
            {conflict.message}
          </Callout>
        ) : null}
        <Field label="Employee" required><Select value={form.employeeId} onChange={(v) => set('employeeId', v)} options={employees} placeholder="Select employee" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Wage" required><MoneyInput value={form.wage} onChange={(v) => set('wage', v)} /></Field>
          <Field label="Wage type" required>
            <SegmentedControl value={form.wageType} onChange={(v) => set('wageType', v)} options={[{ value: 'MONTHLY', label: 'Monthly' }, { value: 'HOURLY', label: 'Hourly' }]} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date" required><DateField value={form.startDate} onChange={(v) => set('startDate', v)} /></Field>
          <Field label="End date" hint="Leave empty for an open-ended contract."><DateField value={form.endDate} min={form.startDate} onChange={(v) => set('endDate', v)} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Working schedule"><Select value={form.workingScheduleId} onChange={(v) => set('workingScheduleId', v)} options={schedules} placeholder="Select schedule" /></Field>
          <Field label="Salary structure"><Select value={form.salaryStructureId} onChange={(v) => set('salaryStructureId', v)} options={structures} placeholder="Select structure" /></Field>
        </div>
        <Field label="Job position"><TextInput value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} placeholder="Payroll Specialist" /></Field>
      </div>
    </Sheet>
  )
}
