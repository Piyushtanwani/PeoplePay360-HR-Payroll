import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Tabs from '@radix-ui/react-tabs'
import { Plus } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { useDepartments, useEmployeeOptions, useTimeOffTypes } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import {
  Button, Callout, Card, CardHeader, Chip, DataTable, DateField, Field, PageHeader, Select, Sheet,
  StatusBadge, TextArea, Toggle, Tooltip, useToast,
} from '@/components/ui'
import { fmtDate } from '@/lib/format'
import type { Holiday, LeaveBalance, Page, TimeOffAllocation, TimeOffRequest, TimeOffType } from '@/api/types'

const TAB_CLASS = 'rounded-control px-3 py-1.5 text-sm2 font-medium text-label2 data-[state=active]:bg-surface data-[state=active]:text-label data-[state=active]:shadow-sm'
const REQUEST_STATES = ['PENDING', 'NEEDS_ATTENTION', 'APPROVED', 'REFUSED', 'CANCELLED'].map((s) => ({ value: s, label: s.replace(/_/g, ' ').toLowerCase() }))

export function TimeOffPage() {
  const { can } = useAuth()
  const [tab, setTab] = React.useState('requests')
  const seesAll = can('timeoff_request.read.all')

  return (
    <>
      <PageHeader title="Time off" description={seesAll ? 'Requests, allocations, policy types and public holidays.' : 'Request leave and track your balances.'} />
      <BalanceCards />
      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className="mb-4 inline-flex gap-1 rounded-control bg-surface2 p-0.5">
          <Tabs.Trigger value="requests" className={TAB_CLASS}>Requests</Tabs.Trigger>
          {can('timeoff_allocation.read.own') ? <Tabs.Trigger value="allocations" className={TAB_CLASS}>Allocations</Tabs.Trigger> : null}
          <Tabs.Trigger value="types" className={TAB_CLASS}>Types</Tabs.Trigger>
          <Tabs.Trigger value="holidays" className={TAB_CLASS}>Holidays</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="requests"><RequestsTab /></Tabs.Content>
        <Tabs.Content value="allocations"><AllocationsTab /></Tabs.Content>
        <Tabs.Content value="types"><TypesTab /></Tabs.Content>
        <Tabs.Content value="holidays"><HolidaysTab /></Tabs.Content>
      </Tabs.Root>
    </>
  )
}

function BalanceCards() {
  const balances = useQuery({ queryKey: ['timeoff', 'balances', 'me'], queryFn: () => api.get<LeaveBalance[]>('/api/timeoff/balances') })
  if (!balances.data?.length) return null
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      {balances.data.map((balance) => (
        <Card key={balance.typeId} className="p-4">
          <p className="text-sm2 text-label2">{balance.typeName}</p>
          <p className="tnum mt-1 text-d3 font-semibold">{balance.available} days</p>
          <p className="tnum mt-1 text-xs2 text-label2">{balance.allocated} allocated · {balance.taken} taken · {balance.pending} pending</p>
        </Card>
      ))}
    </div>
  )
}

function RequestsTab() {
  const { can, employeeId } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const types = useTimeOffTypes()
  const departments = useDepartments()
  const seesAll = can('timeoff_request.read.all')
  const employees = useEmployeeOptions(seesAll)

  const [state, setState] = React.useState<string | null>(null)
  const [typeId, setTypeId] = React.useState<number | null>(null)
  const [departmentId, setDepartmentId] = React.useState<number | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [open, setOpen] = React.useState<TimeOffRequest | null>(null)

  const query = useQuery({
    queryKey: ['timeoff', 'requests', state, typeId, departmentId],
    queryFn: () => api.page<TimeOffRequest>('/api/timeoff/requests', { state, typeId, departmentId, size: 200 }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['timeoff'] })

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'approve' | 'refuse' }) => api.post<TimeOffRequest>(`/api/timeoff/requests/${id}/${action}`),
    onSuccess: (_, { action }) => { invalidate(); setOpen(null); toast.push({ tone: 'success', title: action === 'approve' ? 'Request approved' : 'Request refused' }) },
    onError: (error) => toast.push({ tone: 'error', title: 'Decision failed', detail: error instanceof ApiError ? error.detail : '' }),
  })

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<TimeOffRequest>('/api/timeoff/requests', body),
    onSuccess: (request) => {
      invalidate()
      setCreating(false)
      toast.push({
        tone: request.state === 'NEEDS_ATTENTION' ? 'info' : 'success',
        title: request.state === 'NEEDS_ATTENTION' ? 'Request needs attention' : 'Request submitted',
        detail: request.anomaly ?? `${request.days} day(s) from ${fmtDate(request.startDate)}`,
      })
    },
    onError: (error) => toast.push({ tone: 'error', title: 'Could not submit request', detail: error instanceof ApiError ? error.detail : '' }),
  })

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select className="w-48" value={state} onChange={setState} clearable onClear={() => setState(null)} placeholder="All statuses" options={REQUEST_STATES} />
        <Select className="w-48" value={typeId} onChange={setTypeId} clearable onClear={() => setTypeId(null)} placeholder="All types"
          options={(types.data ?? []).map((t) => ({ value: t.id, label: t.name, swatch: t.color, description: t.isPaid ? 'Paid' : 'Unpaid' }))} />
        {seesAll ? (
          <Select className="w-48" value={departmentId} onChange={setDepartmentId} clearable onClear={() => setDepartmentId(null)} placeholder="All departments"
            options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))} />
        ) : null}
        <Button className="ml-auto" variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>New request</Button>
      </div>

      <Card>
        <DataTable
          rows={query.data?.content ?? []}
          loading={query.isLoading}
          onRowClick={setOpen}
          columns={[
            ...(seesAll ? [{ key: 'employee', header: 'Employee', render: (r: TimeOffRequest) => r.employeeName, sortValue: (r: TimeOffRequest) => r.employeeName }] : []),
            {
              key: 'type', header: 'Type',
              render: (r) => (
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: types.data?.find((t) => t.id === r.typeId)?.color ?? '#0A84FF' }} />
                  {r.typeName}
                </span>
              ),
            },
            { key: 'start', header: 'Start', render: (r) => fmtDate(r.startDate), sortValue: (r) => r.startDate },
            { key: 'end', header: 'End', render: (r) => fmtDate(r.endDate) },
            { key: 'days', header: 'Duration', align: 'right', render: (r) => `${r.days} day${r.days === 1 ? '' : 's'}` },
            {
              key: 'state', header: 'Status',
              render: (r) => (
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={r.state} />
                  {r.anomaly ? <Tooltip content={r.anomaly}><span><Chip tone="warn">why?</Chip></span></Tooltip> : null}
                </div>
              ),
            },
            {
              key: 'actions', header: '', align: 'right',
              render: (r) =>
                can('timeoff_request.approve') && (r.state === 'PENDING' || r.state === 'NEEDS_ATTENTION') ? (
                  <Tooltip content={r.employeeId === employeeId ? 'You cannot approve your own request' : null}>
                    <span className="flex justify-end gap-1.5">
                      <Button size="sm" disabled={r.employeeId === employeeId} onClick={(e) => { e.stopPropagation(); decide.mutate({ id: r.id, action: 'approve' }) }}>Approve</Button>
                      <Button size="sm" disabled={r.employeeId === employeeId} onClick={(e) => { e.stopPropagation(); decide.mutate({ id: r.id, action: 'refuse' }) }}>Refuse</Button>
                    </span>
                  </Tooltip>
                ) : null,
            },
          ]}
        />
      </Card>

      {open ? (
        <Sheet open onOpenChange={(next) => !next && setOpen(null)} title={`Time off request`} description={`${open.employeeName} · ${open.typeName}`}
          footer={<Button onClick={() => setOpen(null)}>Close</Button>}>
          {open.anomaly ? <Callout tone="warn" title="Needs attention">{open.anomaly}</Callout> : null}
          <dl className="mt-4 divide-y divide-separator rounded-card border border-separator">
            {[
              ['Employee', open.employeeName], ['Time off type', open.typeName],
              ['Start date', fmtDate(open.startDate)], ['End date', fmtDate(open.endDate)],
              ['Duration', `${open.days} day(s)`], ['Reason', open.reason ?? '—'],
              ['Approver', open.decidedBy ?? 'Not decided yet'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-4 py-2.5 text-sm2">
                <dt className="text-label2">{label}</dt><dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 px-4 py-2.5 text-sm2"><dt className="text-label2">Status</dt><dd><StatusBadge status={open.state} /></dd></div>
          </dl>
        </Sheet>
      ) : null}

      {creating ? (
        <NewRequestSheet
          onClose={() => setCreating(false)}
          saving={create.isPending}
          canPickEmployee={can('timeoff_request.create.all')}
          employees={(employees.data?.content ?? []).map((e) => ({ value: e.id, label: e.displayName, description: e.employeeNo }))}
          types={types.data ?? []}
          onSubmit={(body) => create.mutate(body)}
        />
      ) : null}
    </>
  )
}

function NewRequestSheet({ onClose, onSubmit, saving, types, employees, canPickEmployee }: {
  onClose: () => void
  onSubmit: (body: Record<string, unknown>) => void
  saving: boolean
  types: TimeOffType[]
  employees: { value: number; label: string; description?: string }[]
  canPickEmployee: boolean
}) {
  const [form, setForm] = React.useState({ employeeId: null as number | null, typeId: null as number | null, startDate: '2026-09-21', endDate: '2026-09-23', reason: '' })
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  const simulate = useQuery({
    queryKey: ['timeoff', 'simulate', form],
    enabled: Boolean(form.typeId && form.startDate && form.endDate),
    queryFn: () => api.post<{ days: number; available: number; projectedAfter: number; anomaly: string | null }>('/api/timeoff/requests/simulate', {
      typeId: form.typeId, startDate: form.startDate, endDate: form.endDate, employeeId: form.employeeId ?? undefined,
    }),
  })

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && onClose()}
      title="New time off request"
      description="Days are calculated from the working schedule, excluding public holidays."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} disabled={!form.typeId} onClick={() => onSubmit({ ...form, employeeId: form.employeeId ?? undefined })}>Submit request</Button>
        </>
      }
    >
      <div className="space-y-4">
        {canPickEmployee ? (
          <Field label="Employee" hint="Leave empty to request for yourself.">
            <Select value={form.employeeId} onChange={(v) => set('employeeId', v)} options={employees} placeholder="Myself" clearable onClear={() => set('employeeId', null)} />
          </Field>
        ) : null}
        <Field label="Time off type" required>
          <Select
            value={form.typeId}
            onChange={(v) => set('typeId', v)}
            placeholder="Select type"
            options={types.map((t) => ({
              value: t.id, label: t.name, swatch: t.color,
              description: `${t.isPaid ? 'Paid' : 'Unpaid'}${t.requiresAllocation ? ' · requires allocation' : ''}`,
            }))}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date" required><DateField value={form.startDate} onChange={(v) => set('startDate', v)} /></Field>
          <Field label="End date" required><DateField value={form.endDate} min={form.startDate} onChange={(v) => set('endDate', v)} /></Field>
        </div>

        {simulate.data ? (
          <Callout tone={simulate.data.anomaly ? 'warn' : 'accent'} title={simulate.data.anomaly ? 'Balance is short' : 'Balance check'}>
            {simulate.data.days} working day{simulate.data.days === 1 ? '' : 's'} · available {simulate.data.available} · projected {simulate.data.projectedAfter}
            {simulate.data.anomaly ? <p className="mt-1">{simulate.data.anomaly}</p> : null}
          </Callout>
        ) : null}

        <Field label="Reason"><TextArea value={form.reason} onChange={(e) => set('reason', e.target.value)} placeholder="Family vacation" /></Field>
      </div>
    </Sheet>
  )
}

function AllocationsTab() {
  const { can, employeeId } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const types = useTimeOffTypes()
  const employees = useEmployeeOptions(can('timeoff_allocation.read.all'))
  const [creating, setCreating] = React.useState(false)

  const query = useQuery({ queryKey: ['timeoff', 'allocations'], queryFn: () => api.page<TimeOffAllocation>('/api/timeoff/allocations', { size: 200 }) })

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'approve' | 'refuse' }) => api.post(`/api/timeoff/allocations/${id}/${action}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['timeoff'] }); toast.push({ tone: 'success', title: 'Allocation updated', detail: 'Requests that were short of balance have been re-evaluated.' }) },
    onError: (error) => toast.push({ tone: 'error', title: 'Could not update allocation', detail: error instanceof ApiError ? error.detail : '' }),
  })

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/api/timeoff/allocations', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['timeoff'] }); setCreating(false); toast.push({ tone: 'success', title: 'Allocation created', detail: 'It stays in draft until approved.' }) },
  })

  return (
    <>
      {can('timeoff_allocation.create.all') ? (
        <div className="mb-4 flex justify-end">
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>New allocation</Button>
        </div>
      ) : null}
      <Card>
        <CardHeader title="Allocations" subtitle="Approved allocations are what create available leave balance." />
        <DataTable
          rows={query.data?.content ?? []}
          loading={query.isLoading}
          columns={[
            { key: 'employee', header: 'Employee', render: (r) => r.employeeName, sortValue: (r) => r.employeeName },
            { key: 'type', header: 'Type', render: (r) => r.typeName },
            { key: 'days', header: 'Allocated', align: 'right', render: (r) => `${r.days} days` },
            { key: 'valid', header: 'Validity', render: (r) => `${fmtDate(r.validFrom)} → ${r.validTo ? fmtDate(r.validTo) : '—'}` },
            { key: 'state', header: 'Status', render: (r) => <StatusBadge status={r.state} /> },
            {
              key: 'actions', header: '', align: 'right',
              render: (r) =>
                can('timeoff_allocation.approve') && r.state === 'DRAFT' ? (
                  <Tooltip content={r.employeeId === employeeId ? 'You cannot approve your own allocation' : null}>
                    <span className="flex justify-end gap-1.5">
                      <Button size="sm" disabled={r.employeeId === employeeId} onClick={() => decide.mutate({ id: r.id, action: 'approve' })}>Approve</Button>
                      <Button size="sm" disabled={r.employeeId === employeeId} onClick={() => decide.mutate({ id: r.id, action: 'refuse' })}>Refuse</Button>
                    </span>
                  </Tooltip>
                ) : null,
            },
          ]}
        />
      </Card>

      {creating ? (
        <AllocationSheet
          onClose={() => setCreating(false)}
          saving={create.isPending}
          employees={(employees.data?.content ?? []).map((e) => ({ value: e.id, label: e.displayName, description: e.employeeNo }))}
          types={(types.data ?? []).map((t) => ({ value: t.id, label: t.name, swatch: t.color }))}
          onSubmit={(body) => create.mutate(body)}
        />
      ) : null}
    </>
  )
}

function AllocationSheet({ onClose, onSubmit, saving, employees, types }: {
  onClose: () => void
  onSubmit: (body: Record<string, unknown>) => void
  saving: boolean
  employees: { value: number; label: string; description?: string }[]
  types: { value: number; label: string; swatch?: string }[]
}) {
  const [form, setForm] = React.useState({ employeeId: null as number | null, typeId: null as number | null, days: 20, validFrom: '2026-01-01', validTo: '2026-12-31', note: '' })
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))
  return (
    <Sheet open onOpenChange={(next) => !next && onClose()} title="New allocation" description="Allocations start in draft and grant balance once approved."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} disabled={!form.employeeId || !form.typeId} onClick={() => onSubmit(form)}>Create allocation</Button></>}>
      <div className="space-y-4">
        <Field label="Employee" required><Select value={form.employeeId} onChange={(v) => set('employeeId', v)} options={employees} placeholder="Select employee" /></Field>
        <Field label="Time off type" required><Select value={form.typeId} onChange={(v) => set('typeId', v)} options={types} placeholder="Select type" /></Field>
        <Field label="Days" required>
          <input type="number" min={0} value={form.days} onChange={(e) => set('days', Number(e.target.value))}
            className="tnum h-9 w-full rounded-control border border-separator bg-surface px-3 outline-none focus:border-accent" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valid from"><DateField value={form.validFrom} onChange={(v) => set('validFrom', v)} /></Field>
          <Field label="Valid to"><DateField value={form.validTo} min={form.validFrom} onChange={(v) => set('validTo', v)} /></Field>
        </div>
        <Field label="Note"><TextArea value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="Annual leave balance granted at start of policy year." /></Field>
      </div>
    </Sheet>
  )
}

function TypesTab() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const types = useTimeOffTypes()

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<TimeOffType> }) => api.put(`/api/timeoff/types/${id}`, patch),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['timeoff', 'types'] }); toast.push({ tone: 'success', title: 'Policy updated' }) },
  })

  return (
    <Card>
      <CardHeader title="Time off types" subtitle="This list defines policy rules, not employee transactions." />
      <DataTable
        rows={types.data ?? []}
        loading={types.isLoading}
        columns={[
          {
            key: 'name', header: 'Type',
            render: (r) => <span className="flex items-center gap-2 font-medium"><span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />{r.name}</span>,
          },
          { key: 'code', header: 'Code', render: (r) => <span className="tnum text-label2">{r.code}</span> },
          { key: 'unit', header: 'Unit', render: (r) => r.unit.toLowerCase() },
          {
            key: 'paid', header: 'Paid',
            render: (r) => <Toggle checked={r.isPaid} disabled={!can('timeoff_type.manage')} onChange={(v) => update.mutate({ id: r.id, patch: { isPaid: v } })} label={`${r.name} paid`} />,
          },
          {
            key: 'allocation', header: 'Requires allocation',
            render: (r) => <Toggle checked={r.requiresAllocation} disabled={!can('timeoff_type.manage')} onChange={(v) => update.mutate({ id: r.id, patch: { requiresAllocation: v } })} label={`${r.name} allocation`} />,
          },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.active ? 'ACTIVE' : 'CANCELLED'} /> },
        ]}
      />
    </Card>
  )
}

function HolidaysTab() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['timeoff', 'holidays'], queryFn: () => api.get<Holiday[]>('/api/timeoff/holidays', { year: 2026 }) })
  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/api/timeoff/holidays/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timeoff', 'holidays'] }),
  })
  return (
    <Card>
      <CardHeader title="Public holidays 2026" subtitle="Holidays are excluded when leave duration is calculated." />
      <DataTable
        rows={query.data ?? []}
        loading={query.isLoading}
        columns={[
          { key: 'name', header: 'Holiday', render: (r) => r.name },
          { key: 'date', header: 'Date', render: (r) => fmtDate(r.date), sortValue: (r) => r.date },
          {
            key: 'actions', header: '', align: 'right',
            render: (r) => (can('timeoff_type.manage') ? <Button size="sm" onClick={() => remove.mutate(r.id)}>Remove</Button> : null),
          },
        ]}
      />
    </Card>
  )
}
