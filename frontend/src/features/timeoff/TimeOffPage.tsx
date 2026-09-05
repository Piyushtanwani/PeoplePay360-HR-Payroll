import * as React from 'react'
import { Link } from 'react-router-dom'
import { CalendarOff, CalendarPlus, Plus, Trash2 } from 'lucide-react'
import {
  useCreateAllocation, useCreateHoliday, useDecideAllocation, useDecideRequest, useDeleteHoliday,
  useEmployeeOptions, useHolidays, useLeaveBalances, useSaveTimeOffType, useTimeOffAllocations,
  useTimeOffRequests, useTimeOffTypes,
} from '@/api/hooks'
import { ALLOCATION_STATE_OPTIONS, REQUEST_STATE_OPTIONS } from '@/api/constants'
import { useAuth } from '@/auth/AuthProvider'
import {
  ActiveBadge, Button, Card, ConfirmDialog, DataTable, DateField, DetailList, Field, HelpItems,
  HelpPopover, IconButton, NumberInput, PageHeader, Select, Sheet, StatusBadge, StatusLegend,
  TabPanel, Tabs, TextInput, Toggle, Tooltip, type Column,
} from '@/components/ui'
import { nearbyYears, todayIso, yearBounds } from '@/lib/dates'
import { fmtDate } from '@/lib/format'
import { useNumberParamState, useSearchParamState } from '@/lib/hooks/useSearchParamState'
import { useTableState } from '@/lib/hooks/useTableState'
import { LeaveBalanceCards } from '../employees/LeaveBalanceCards'
import { NewRequestSheet } from './NewRequestSheet'
import type { Holiday, TimeOffAllocation, TimeOffRequest, TimeOffType } from '@/api/types'

export function TimeOffPage() {
  const { can } = useAuth()
  const seesEveryone = can('timeoff_request.read.all')
  const balances = useLeaveBalances(null, !seesEveryone)

  return (
    <>
      <PageHeader
        title="Time off"
        description="Leave requests, the allocations that create balance, the types on offer, and the public holidays."
        help={
          <HelpPopover title="How leave works here">
            <HelpItems
              items={[
                { term: 'Allocation first', text: 'Balance comes from an approved allocation. A draft allocation grants nothing.' },
                { term: 'Counting days', text: 'From the working schedule, so weekends and public holidays are not deducted.' },
                { term: 'Needs attention', text: 'A request for more days than are available. It can still be approved deliberately.' },
                { term: 'Paid and unpaid', text: 'Unpaid leave reduces that month’s pay through the payroll input for unpaid days.' },
                { term: 'Own requests', text: 'Nobody approves or refuses their own, including administrators.' },
              ]}
            />
          </HelpPopover>
        }
      />

      {!seesEveryone ? (
        <div className="mb-4">
          <LeaveBalanceCards balances={balances.data ?? []} loading={balances.isLoading} />
        </div>
      ) : null}

      <Tabs
        urlKey="tab"
        items={[
          { value: 'requests', label: 'Requests' },
          { value: 'allocations', label: 'Allocations', hidden: !can('timeoff_allocation.read.own') },
          { value: 'types', label: 'Types', hidden: !can('timeoff_type.read') },
          { value: 'holidays', label: 'Holidays', hidden: !can('timeoff_type.read') },
        ]}
      >
        <TabPanel value="requests"><RequestsTab /></TabPanel>
        <TabPanel value="allocations"><AllocationsTab /></TabPanel>
        <TabPanel value="types"><TypesTab /></TabPanel>
        <TabPanel value="holidays"><HolidaysTab /></TabPanel>
      </Tabs>
    </>
  )
}

function RequestsTab() {
  const { can, employeeId: myEmployeeId } = useAuth()
  const canApprove = can('timeoff_request.approve')
  const canCreate = can('timeoff_request.create.own') || can('timeoff_request.create.all')
  const employees = useEmployeeOptions(can('employee.read.all'))
  const types = useTimeOffTypes()

  const [state, setState] = useSearchParamState<string>('state', '')
  const [typeId, setTypeId] = useNumberParamState('typeId')
  const [employeeId, setEmployeeId] = useNumberParamState('employeeId')

  const table = useTableState({ defaultSort: 'startDate', defaultDir: 'desc' })
  const list = useTimeOffRequests({ ...table.params, state: state || undefined, typeId, employeeId })

  const [creating, setCreating] = React.useState(false)
  const [open, setOpen] = React.useState<TimeOffRequest | null>(null)
  const [cancelling, setCancelling] = React.useState<TimeOffRequest | null>(null)
  const decide = useDecideRequest()

  const columns: Column<TimeOffRequest>[] = [
    {
      key: 'employeeId',
      header: 'Employee',
      sortable: true,
      render: (r) => (
        <Link to={`/employees/${r.employeeId}`} onClick={(e) => e.stopPropagation()} className="font-medium text-accent hover:underline">
          {r.employeeName}
        </Link>
      ),
    },
    { key: 'type', header: 'Type', render: (r) => r.typeName },
    { key: 'startDate', header: 'From', sortable: true, render: (r) => fmtDate(r.startDate) },
    { key: 'endDate', header: 'To', sortable: true, render: (r) => fmtDate(r.endDate) },
    { key: 'days', header: 'Days', align: 'right', sortable: true, render: (r) => r.days },
    {
      key: 'state',
      header: 'Status',
      sortable: true,
      render: (r) => (
        <span className="flex items-center gap-1.5">
          <StatusBadge status={r.state} />
          {r.anomaly ? (
            <Tooltip content={r.anomaly}>
              <span className="cursor-help text-xs2 text-warn">why?</span>
            </Tooltip>
          ) : null}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '170px',
      render: (r) => {
        const pending = r.state === 'PENDING' || r.state === 'NEEDS_ATTENTION'
        const isMine = r.employeeId === myEmployeeId
        return (
          <span className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {canApprove && pending ? (
              isMine ? (
                <Tooltip content="Nobody decides on their own request, including administrators.">
                  <span><Button size="sm" disabled>Approve</Button></span>
                </Tooltip>
              ) : (
                <>
                  <Button size="sm" variant="primary" onClick={() => decide.mutate({ id: r.id, action: 'approve' })}>
                    Approve
                  </Button>
                  <Button size="sm" onClick={() => decide.mutate({ id: r.id, action: 'refuse' })}>Refuse</Button>
                </>
              )
            ) : null}
            {isMine && ['PENDING', 'NEEDS_ATTENTION', 'APPROVED'].includes(r.state) ? (
              <Button size="sm" onClick={() => setCancelling(r)}>Cancel</Button>
            ) : null}
          </span>
        )
      },
    },
  ]

  return (
    <>
      <Card>
        <DataTable
          rows={list.data?.content ?? []}
          columns={columns}
          table={table}
          total={list.data?.totalElements}
          loading={list.isLoading}
          fetching={list.isFetching}
          error={list.error}
          onRetry={() => list.refetch()}
          onRowClick={(r) => setOpen(r)}
          toolbar={{
            filters: (
              <>
                <Select value={state} onChange={setState} options={REQUEST_STATE_OPTIONS} className="w-48" />
                <Select
                  value={typeId}
                  onChange={setTypeId}
                  clearable
                  onClear={() => setTypeId(null)}
                  placeholder="All types"
                  className="w-44"
                  options={(types.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
                />
                {can('employee.read.all') ? (
                  <Select
                    value={employeeId}
                    onChange={setEmployeeId}
                    clearable
                    onClear={() => setEmployeeId(null)}
                    placeholder="All employees"
                    className="w-52"
                    options={(employees.data?.content ?? []).map((e) => ({ value: e.id, label: e.displayName }))}
                  />
                ) : null}
                <StatusLegend statuses={['PENDING', 'NEEDS_ATTENTION', 'APPROVED', 'REFUSED', 'CANCELLED']} />
              </>
            ),
            actions: canCreate ? (
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
                New request
              </Button>
            ) : undefined,
          }}
          empty={{
            icon: <CalendarOff className="h-6 w-6" />,
            title: 'No leave requests',
            description: 'Requests appear here once someone asks for time off.',
            action: canCreate ? (
              <Button variant="primary" onClick={() => setCreating(true)}>Request time off</Button>
            ) : undefined,
          }}
        />
      </Card>

      <NewRequestSheet open={creating} onOpenChange={setCreating} />

      <Sheet
        open={open !== null}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        title="Leave request"
        description="Days are counted from the working schedule, excluding public holidays."
        footer={<Button onClick={() => setOpen(null)}>Close</Button>}
      >
        {open ? (
          <DetailList
            items={[
              { label: 'Employee', value: open.employeeName },
              { label: 'Type', value: open.typeName },
              { label: 'From', value: fmtDate(open.startDate) },
              { label: 'To', value: fmtDate(open.endDate) },
              { label: 'Working days', value: open.days, tnum: true },
              { label: 'Status', value: <StatusBadge status={open.state} /> },
              { label: 'Needs attention because', value: open.anomaly, hidden: !open.anomaly },
              { label: 'Reason given', value: open.reason || '—' },
              { label: 'Decision note', value: open.decisionNote, hidden: !open.decisionNote },
            ]}
          />
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(isOpen) => !isOpen && setCancelling(null)}
        title="Cancel this request?"
        sentence={
          cancelling?.state === 'APPROVED'
            ? `The ${cancelling.days} approved days return to your balance.`
            : 'The request is withdrawn. You can submit a new one at any time.'
        }
        confirmLabel="Cancel request"
        tone="danger"
        loading={decide.isPending}
        onConfirm={() =>
          cancelling &&
          decide.mutate({ id: cancelling.id, action: 'cancel' }, { onSuccess: () => setCancelling(null) })
        }
      />
    </>
  )
}

function AllocationsTab() {
  const { can, employeeId: myEmployeeId } = useAuth()
  const canApprove = can('timeoff_allocation.approve')
  const canCreate = can('timeoff_allocation.create.all')
  const employees = useEmployeeOptions(can('employee.read.all'))
  const types = useTimeOffTypes()

  const [state, setState] = useSearchParamState<string>('allocState', '')
  const table = useTableState({ prefix: 'al.', defaultSort: 'validFrom', defaultDir: 'desc' })
  const list = useTimeOffAllocations({ ...table.params, state: state || undefined })

  const [creating, setCreating] = React.useState(false)
  const decide = useDecideAllocation()
  const create = useCreateAllocation(() => setCreating(false))

  const columns: Column<TimeOffAllocation>[] = [
    { key: 'employeeId', header: 'Employee', sortable: true, render: (r) => r.employeeName },
    { key: 'type', header: 'Type', render: (r) => r.typeName },
    { key: 'days', header: 'Days', align: 'right', sortable: true, render: (r) => r.days },
    {
      key: 'taken',
      header: 'Used',
      align: 'right',
      tooltip: 'Approved leave of this type falling inside the allocation’s validity.',
      render: (r) => r.taken,
    },
    { key: 'remaining', header: 'Left', align: 'right', render: (r) => r.remaining },
    { key: 'validFrom', header: 'Valid from', sortable: true, render: (r) => fmtDate(r.validFrom) },
    { key: 'validTo', header: 'Valid to', sortable: true, render: (r) => fmtDate(r.validTo) },
    { key: 'state', header: 'Status', sortable: true, render: (r) => <StatusBadge status={r.state} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '170px',
      hidden: !canApprove,
      render: (r) =>
        r.state !== 'DRAFT' ? null : r.employeeId === myEmployeeId ? (
          <Tooltip content="Nobody approves their own allocation.">
            <span><Button size="sm" disabled>Approve</Button></span>
          </Tooltip>
        ) : (
          <span className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="primary" onClick={() => decide.mutate({ id: r.id, action: 'approve' })}>
              Approve
            </Button>
            <Button size="sm" onClick={() => decide.mutate({ id: r.id, action: 'refuse' })}>Refuse</Button>
          </span>
        ),
    },
  ]

  return (
    <>
      <Card>
        <DataTable
          rows={list.data?.content ?? []}
          columns={columns}
          table={table}
          total={list.data?.totalElements}
          loading={list.isLoading}
          fetching={list.isFetching}
          error={list.error}
          onRetry={() => list.refetch()}
          toolbar={{
            filters: <Select value={state} onChange={setState} options={ALLOCATION_STATE_OPTIONS} className="w-44" />,
            actions: canCreate ? (
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
                New allocation
              </Button>
            ) : undefined,
          }}
          empty={{
            title: 'No allocations',
            description: 'An approved allocation is what creates leave balance. Without one, nobody has days to take.',
            action: canCreate ? (
              <Button variant="primary" onClick={() => setCreating(true)}>Create an allocation</Button>
            ) : undefined,
          }}
        />
      </Card>

      <AllocationSheet
        open={creating}
        onOpenChange={setCreating}
        saving={create.isPending}
        employees={(employees.data?.content ?? []).map((e) => ({ value: e.id, label: e.displayName, description: e.employeeNo }))}
        types={(types.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
        onSubmit={(body) => create.mutate(body)}
      />
    </>
  )
}

function AllocationSheet({ open, onOpenChange, saving, employees, types, onSubmit }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  saving: boolean
  employees: { value: number; label: string; description?: string }[]
  types: { value: number; label: string }[]
  onSubmit: (body: Record<string, unknown>) => void
}) {
  const year = new Date().getFullYear()
  const bounds = yearBounds(year)
  const [form, setForm] = React.useState({
    employeeId: null as number | null,
    typeId: null as number | null,
    days: 0,
    validFrom: bounds.start,
    validTo: bounds.end,
    note: '',
  })
  React.useEffect(() => {
    if (open) setForm({ employeeId: null, typeId: null, days: 0, validFrom: bounds.start, validTo: bounds.end, note: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }))
  const valid = form.employeeId && form.typeId && form.days > 0

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="New leave allocation"
      description="Created as a draft. Approving it is what turns these days into balance the person can take."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" loading={saving} disabled={!valid} onClick={() => onSubmit(form)}>
            Create allocation
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Employee" required>
          <Select value={form.employeeId} onChange={(v) => set('employeeId', v)} options={employees} placeholder="Select employee" />
        </Field>
        <Field label="Leave type" required>
          <Select value={form.typeId} onChange={(v) => set('typeId', v)} options={types} placeholder="Select type" />
        </Field>
        <Field label="Days" required htmlFor="alloc-days">
          <NumberInput id="alloc-days" value={form.days} min={0} step={0.5} suffix="days" onChange={(v) => set('days', v)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valid from" hint="Leave taken outside these dates does not count against this allocation.">
            <DateField value={form.validFrom} onChange={(v) => set('validFrom', v)} />
          </Field>
          <Field label="Valid to">
            <DateField value={form.validTo} min={form.validFrom} onChange={(v) => set('validTo', v)} />
          </Field>
        </div>
        <Field label="Note">
          <TextInput value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="Annual entitlement for the year" />
        </Field>
      </div>
    </Sheet>
  )
}

function TypesTab() {
  const { can } = useAuth()
  const canManage = can('timeoff_type.manage')
  const types = useTimeOffTypes()
  // Held entirely in memory, so the table filters, sorts and pages the rows locally.
  const table = useTableState({ prefix: 'ty.', url: false, defaultSort: 'name' })
  const save = useSaveTimeOffType()

  const [editing, setEditing] = React.useState<TimeOffType | null | 'new'>(null)
  const sheetSave = useSaveTimeOffType(() => setEditing(null))

  const columns: Column<TimeOffType>[] = [
    { key: 'name', header: 'Type', sortValue: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'code', header: 'Code', sortValue: (r) => r.code, render: (r) => <span className="tnum">{r.code}</span> },
    {
      key: 'isPaid',
      header: 'Paid',
      tooltip: 'Paid leave counts as a worked day. Unpaid leave reduces that month’s pay.',
      render: (r) =>
        canManage ? (
          <Toggle
            checked={r.isPaid}
            onChange={(v) => save.mutate({ id: r.id, body: { name: r.name, code: r.code, isPaid: v } })}
            label={`${r.name} is paid`}
          />
        ) : (
          <ActiveBadge active={r.isPaid} labels={['Paid', 'Unpaid']} />
        ),
    },
    {
      key: 'requiresAllocation',
      header: 'Needs allocation',
      tooltip: 'When on, someone must be allocated days before they can request this type.',
      render: (r) =>
        canManage ? (
          <Toggle
            checked={r.requiresAllocation}
            onChange={(v) => save.mutate({ id: r.id, body: { name: r.name, code: r.code, requiresAllocation: v } })}
            label={`${r.name} requires an allocation`}
          />
        ) : (
          <ActiveBadge active={r.requiresAllocation} labels={['Yes', 'No']} />
        ),
    },
    { key: 'active', header: 'Status', sortValue: (r) => String(r.active), render: (r) => <ActiveBadge active={r.active} /> },
  ]

  return (
    <>
      <Card>
        <DataTable
          rows={types.data ?? []}
          columns={columns}
          table={table}
          searchKeys={[(r) => r.name, (r) => r.code]}
          loading={types.isLoading}
          error={types.error}
          onRetry={() => types.refetch()}
          onRowClick={canManage ? (r) => setEditing(r) : undefined}
          toolbar={{
            search: 'Search types',
            actions: canManage ? (
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
                New type
              </Button>
            ) : undefined,
          }}
          empty={{
            title: 'No leave types',
            description: 'Types are the policy: what leave exists, whether it is paid, and whether it needs an allocation.',
            action: canManage ? <Button variant="primary" onClick={() => setEditing('new')}>Add a type</Button> : undefined,
          }}
        />
      </Card>

      <TypeSheet
        open={editing !== null}
        type={editing === 'new' ? null : editing}
        saving={sheetSave.isPending}
        onOpenChange={(open) => !open && setEditing(null)}
        onSubmit={(body) => sheetSave.mutate({ id: editing === 'new' || !editing ? null : editing.id, body })}
      />
    </>
  )
}

function TypeSheet({ open, type, saving, onOpenChange, onSubmit }: {
  open: boolean
  type: TimeOffType | null
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (body: Record<string, unknown>) => void
}) {
  const [form, setForm] = React.useState({ name: '', code: '', isPaid: true, requiresAllocation: true, active: true })
  React.useEffect(() => {
    if (!open) return
    setForm(
      type
        ? { name: type.name, code: type.code, isPaid: type.isPaid, requiresAllocation: type.requiresAllocation, active: type.active }
        : { name: '', code: '', isPaid: true, requiresAllocation: true, active: true },
    )
  }, [open, type])

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={type ? `Edit ${type.name}` : 'New leave type'}
      description="Policy, not a transaction. Changing a type affects how future requests behave."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!form.name.trim() || !form.code.trim()}
            onClick={() => onSubmit({ ...form, name: form.name.trim(), code: form.code.trim().toUpperCase() })}
          >
            {type ? 'Save' : 'Create type'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required>
          <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Annual Leave" />
        </Field>
        <Field label="Code" required hint="A short identifier used in reports and payroll inputs.">
          <TextInput value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="ANNUAL" />
        </Field>
        <div className="flex items-center justify-between rounded-card border border-separator px-4 py-3">
          <div>
            <p className="text-sm2 font-medium">Paid</p>
            <p className="text-xs2 text-label2">Paid leave counts as a worked day. Unpaid leave reduces that month’s pay.</p>
          </div>
          <Toggle checked={form.isPaid} onChange={(v) => set('isPaid', v)} label="Paid" />
        </div>
        <div className="flex items-center justify-between rounded-card border border-separator px-4 py-3">
          <div>
            <p className="text-sm2 font-medium">Requires an allocation</p>
            <p className="text-xs2 text-label2">Requests beyond the allocated balance are flagged for attention.</p>
          </div>
          <Toggle checked={form.requiresAllocation} onChange={(v) => set('requiresAllocation', v)} label="Requires allocation" />
        </div>
        <div className="flex items-center justify-between rounded-card border border-separator px-4 py-3">
          <div>
            <p className="text-sm2 font-medium">Available</p>
            <p className="text-xs2 text-label2">Existing requests are kept; the type is no longer offered for new ones.</p>
          </div>
          <Toggle checked={form.active} onChange={(v) => set('active', v)} label="Available" />
        </div>
      </div>
    </Sheet>
  )
}

function HolidaysTab() {
  const { can } = useAuth()
  const canManage = can('timeoff_type.manage')
  const [year, setYear] = useSearchParamState<number>('year', new Date().getFullYear(), (raw) => Number(raw))
  const holidays = useHolidays(year)
  // Held entirely in memory, so the table filters, sorts and pages the rows locally.
  const table = useTableState({ prefix: 'hol.', url: false, defaultSort: 'date' })

  const [adding, setAdding] = React.useState(false)
  const [deleting, setDeleting] = React.useState<Holiday | null>(null)
  const create = useCreateHoliday(() => setAdding(false))
  const remove = useDeleteHoliday(() => setDeleting(null))
  const [form, setForm] = React.useState({ date: todayIso(), name: '' })

  React.useEffect(() => { if (adding) setForm({ date: todayIso(), name: '' }) }, [adding])

  const columns: Column<Holiday>[] = [
    { key: 'date', header: 'Date', sortValue: (r) => r.date, render: (r) => fmtDate(r.date) },
    { key: 'name', header: 'Holiday', sortValue: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '56px',
      hidden: !canManage,
      render: (r) => (
        <span onClick={(e) => e.stopPropagation()}>
          <IconButton label={`Remove ${r.name}`} onClick={() => setDeleting(r)}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </span>
      ),
    },
  ]

  return (
    <>
      <Card>
        <DataTable
          rows={holidays.data ?? []}
          columns={columns}
          table={table}
          searchKeys={[(r) => r.name]}
          loading={holidays.isLoading}
          error={holidays.error}
          onRetry={() => holidays.refetch()}
          toolbar={{
            search: 'Search holidays',
            filters: (
              <Select
                value={String(year)}
                onChange={(v) => setYear(Number(v))}
                className="w-32"
                options={nearbyYears().map((y) => ({ value: String(y), label: String(y) }))}
              />
            ),
            actions: (
              <div className="flex items-center gap-2">
                <HelpPopover title="What holidays affect" size="sm">
                  <HelpItems
                    items={[
                      { term: 'Leave', text: 'A holiday inside a leave request is not counted as a leave day.' },
                      { term: 'Attendance', text: 'A holiday is never treated as an absence.' },
                      { term: 'Payroll', text: 'Holidays are excluded from the scheduled days a period expects.' },
                    ]}
                  />
                </HelpPopover>
                {canManage ? (
                  <Button variant="primary" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => setAdding(true)}>
                    Add holiday
                  </Button>
                ) : null}
              </div>
            ),
          }}
          empty={{
            title: `No holidays recorded for ${year}`,
            description: 'Without them, holidays count as scheduled working days for both leave and payroll.',
            action: canManage ? <Button variant="primary" onClick={() => setAdding(true)}>Add the first holiday</Button> : undefined,
          }}
        />
      </Card>

      <Sheet
        open={adding}
        onOpenChange={setAdding}
        title="Add a public holiday"
        description="Excluded from scheduled days, so it affects both leave duration and payroll."
        footer={
          <>
            <Button onClick={() => setAdding(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={create.isPending}
              disabled={!form.name.trim() || !form.date}
              onClick={() => create.mutate({ date: form.date, name: form.name.trim() })}
            >
              Add holiday
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Date" required>
            <DateField value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          </Field>
          <Field label="Name" required>
            <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Republic Day" />
          </Field>
        </div>
      </Sheet>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Remove ${deleting?.name}?`}
        sentence="That date becomes an ordinary working day again for leave counting and for payroll."
        confirmLabel="Remove holiday"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  )
}
