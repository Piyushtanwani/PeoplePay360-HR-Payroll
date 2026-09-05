import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Tabs from '@radix-ui/react-tabs'
import { LogIn, LogOut, Timer } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { useDepartments, useEmployeeOptions } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import {
  Button, Card, CardHeader, Chip, DataTable, DateField, Field, PageHeader, Select, Sheet, StatusBadge,
  TextArea, TimeField, Tooltip, useToast,
} from '@/components/ui'
import { fmtDate, fmtTime, minutesToHours } from '@/lib/format'
import type { Attendance, AttendanceException, Page } from '@/api/types'

const TAB_CLASS = 'rounded-control px-3 py-1.5 text-sm2 font-medium text-label2 data-[state=active]:bg-surface data-[state=active]:text-label data-[state=active]:shadow-sm'
const STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'OVERTIME', 'MISSING_CHECKOUT'].map((s) => ({ value: s, label: s.replace(/_/g, ' ').toLowerCase() }))

export function AttendancePage() {
  const { can, employeeId } = useAuth()
  const seesAll = can('attendance.read.all')

  return (
    <>
      <PageHeader
        title="Attendance"
        description={seesAll ? 'Review raw check-in and check-out data and resolve exceptions before payroll.' : 'Mark your attendance and review your own records.'}
      />
      {can('attendance.create.own') ? <QuickAction /> : null}
      {seesAll ? <HrAttendance /> : <OwnAttendance employeeId={employeeId} />}
    </>
  )
}

function useElapsed(since: string | null) {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    if (!since) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [since])
  if (!since) return '0h00'
  const minutes = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60000))
  return minutesToHours(minutes)
}

function QuickAction() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const today = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => api.get<{ openAttendance: Attendance | null; todayRows: Attendance[] }>('/api/attendance/today'),
  })
  const open = today.data?.openAttendance ?? null
  const elapsed = useElapsed(open?.checkIn ?? null)

  const mutate = useMutation({
    mutationFn: (action: 'check-in' | 'check-out') => api.post<Attendance>(`/api/attendance/${action}`),
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      toast.push({ tone: 'success', title: action === 'check-in' ? 'Checked in' : 'Checked out' })
    },
    onError: (error) => toast.push({ tone: 'error', title: 'Attendance action failed', detail: error instanceof ApiError ? error.detail : '' }),
  })

  return (
    <Card className="mb-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`grid h-11 w-11 place-items-center rounded-full ${open ? 'bg-ok/15 text-ok' : 'bg-bad/12 text-bad'}`}>
            <Timer className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[17px] font-semibold">{open ? 'You are checked in' : 'Not checked in'}</p>
            <p className="tnum text-sm2 text-label2">
              {open ? `Since ${fmtTime(open.checkIn)} · ${elapsed} elapsed` : 'Start your day with a single tap.'}
            </p>
          </div>
        </div>
        <Button
          variant={open ? 'danger' : 'primary'}
          size="lg"
          loading={mutate.isPending}
          icon={open ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
          onClick={() => mutate.mutate(open ? 'check-out' : 'check-in')}
        >
          {open ? 'Check out' : 'Check in'}
        </Button>
      </div>
      {today.data?.todayRows.length ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-separator pt-3">
          {today.data.todayRows.map((row) => (
            <Chip key={row.id} tone={row.checkOut ? 'ok' : 'warn'}>
              {fmtTime(row.checkIn)} → {row.checkOut ? fmtTime(row.checkOut) : 'open'}
            </Chip>
          ))}
        </div>
      ) : null}
    </Card>
  )
}

function OwnAttendance({ employeeId }: { employeeId: number | null }) {
  const query = useQuery({
    queryKey: ['attendance', 'own', employeeId],
    queryFn: () => api.page<Attendance>('/api/attendance', { size: 60 }),
  })
  return (
    <Card>
      <CardHeader title="My attendance" subtitle="Your last 60 records." />
      <DataTable
        rows={query.data?.content ?? []}
        loading={query.isLoading}
        columns={[
          { key: 'date', header: 'Date', render: (r) => fmtDate(r.workDate), sortValue: (r) => r.workDate },
          { key: 'in', header: 'Check in', render: (r) => fmtTime(r.checkIn) },
          { key: 'out', header: 'Check out', render: (r) => fmtTime(r.checkOut) },
          { key: 'worked', header: 'Worked hours', align: 'right', render: (r) => minutesToHours(r.workedMinutes) },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
    </Card>
  )
}

function HrAttendance() {
  const { employeeId: myEmployeeId, can } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const departments = useDepartments()
  const employees = useEmployeeOptions()

  const [tab, setTab] = React.useState('records')
  const [filters, setFilters] = React.useState({ employeeId: null as number | null, departmentId: null as number | null, status: null as string | null, from: '2026-08-01', to: '2026-09-05' })
  const [period, setPeriod] = React.useState('2026-09')
  const [exceptionType, setExceptionType] = React.useState<string | null>(null)
  const [correcting, setCorrecting] = React.useState<Attendance | null>(null)
  const [resolving, setResolving] = React.useState<AttendanceException | null>(null)

  const records = useQuery({
    queryKey: ['attendance', 'hr', filters],
    queryFn: () => api.page<Attendance>('/api/attendance', { ...filters, size: 100 }),
  })

  const exceptions = useQuery({
    queryKey: ['attendance', 'exceptions', period, exceptionType],
    queryFn: () => api.page<AttendanceException>('/api/attendance/exceptions', { period, type: exceptionType, resolved: false, size: 100 }),
  })

  const correct = useMutation({
    mutationFn: (body: { id: number; checkIn?: string; checkOut?: string; editReason: string }) =>
      api.put<Attendance>(`/api/attendance/${body.id}`, { checkIn: body.checkIn, checkOut: body.checkOut, editReason: body.editReason }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['attendance'] }); setCorrecting(null); toast.push({ tone: 'success', title: 'Attendance corrected', detail: 'The change is recorded in the audit log.' }) },
    onError: (error) => toast.push({ tone: 'error', title: 'Could not correct attendance', detail: error instanceof ApiError ? error.detail : '' }),
  })

  const resolve = useMutation({
    mutationFn: (body: { id: number; checkOut?: string; reason: string }) => api.post(`/api/attendance/exceptions/${body.id}/resolve`, { checkOut: body.checkOut, reason: body.reason }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['attendance'] }); setResolving(null); toast.push({ tone: 'success', title: 'Exception resolved' }) },
  })

  const recompute = useMutation({
    mutationFn: () => api.post(`/api/attendance/recompute`, undefined, { period }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['attendance'] }); toast.push({ tone: 'info', title: 'Attendance reclassified for the period' }) },
  })

  const grouped = (exceptions.data?.content ?? []).reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.type]: (acc[row.type] ?? 0) + 1 }), {})

  return (
    <Tabs.Root value={tab} onValueChange={setTab}>
      <Tabs.List className="mb-4 inline-flex gap-1 rounded-control bg-surface2 p-0.5">
        <Tabs.Trigger value="records" className={TAB_CLASS}>Records</Tabs.Trigger>
        <Tabs.Trigger value="exceptions" className={TAB_CLASS}>
          Exceptions {exceptions.data?.totalElements ? <Chip tone="warn" className="ml-1.5">{exceptions.data.totalElements}</Chip> : null}
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="records">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select value={filters.employeeId} onChange={(v) => setFilters((f) => ({ ...f, employeeId: v }))} clearable onClear={() => setFilters((f) => ({ ...f, employeeId: null }))}
            placeholder="All employees" options={(employees.data?.content ?? []).map((e) => ({ value: e.id, label: e.displayName, description: e.employeeNo }))} />
          <Select value={filters.departmentId} onChange={(v) => setFilters((f) => ({ ...f, departmentId: v }))} clearable onClear={() => setFilters((f) => ({ ...f, departmentId: null }))}
            placeholder="All departments" options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))} />
          <Select value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} clearable onClear={() => setFilters((f) => ({ ...f, status: null }))}
            placeholder="All statuses" options={STATUSES} />
          <DateField value={filters.from} onChange={(v) => setFilters((f) => ({ ...f, from: v }))} />
          <DateField value={filters.to} min={filters.from} onChange={(v) => setFilters((f) => ({ ...f, to: v }))} />
        </div>

        <Card>
          <DataTable
            rows={records.data?.content ?? []}
            loading={records.isLoading}
            columns={[
              { key: 'employee', header: 'Employee', render: (r) => r.employeeName, sortValue: (r) => r.employeeName },
              { key: 'date', header: 'Date', render: (r) => fmtDate(r.workDate), sortValue: (r) => r.workDate },
              { key: 'in', header: 'Check in', render: (r) => fmtTime(r.checkIn) },
              { key: 'out', header: 'Check out', render: (r) => fmtTime(r.checkOut) },
              { key: 'worked', header: 'Worked', align: 'right', render: (r) => minutesToHours(r.workedMinutes) },
              { key: 'scheduled', header: 'Scheduled', align: 'right', render: (r) => minutesToHours(r.scheduledMinutes) },
              {
                key: 'status', header: 'Status',
                render: (r) => (
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={r.status} />
                    {r.isManualEdit ? <Tooltip content={r.editReason ?? 'Manually corrected'}><span><Chip tone="warn">edited</Chip></span></Tooltip> : null}
                  </div>
                ),
              },
              {
                key: 'actions', header: '', align: 'right',
                render: (r) =>
                  can('attendance.update.all') ? (
                    <Tooltip content={r.employeeId === myEmployeeId ? 'You cannot correct your own attendance' : null}>
                      <span>
                        <Button size="sm" disabled={r.employeeId === myEmployeeId} onClick={(e) => { e.stopPropagation(); setCorrecting(r) }}>Correct</Button>
                      </span>
                    </Tooltip>
                  ) : null,
              },
            ]}
          />
        </Card>
      </Tabs.Content>

      <Tabs.Content value="exceptions">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Select className="w-44" value={period} onChange={setPeriod} options={['2026-09', '2026-08', '2026-07', '2026-06'].map((p) => ({ value: p, label: p }))} />
          <Select className="w-52" value={exceptionType} onChange={setExceptionType} clearable onClear={() => setExceptionType(null)} placeholder="All exception types"
            options={['LATE', 'ABSENT', 'OVERTIME', 'MISSING_CHECKOUT'].map((t) => ({ value: t, label: t.replace(/_/g, ' ').toLowerCase() }))} />
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(grouped).map(([type, count]) => (
              <Chip key={type} tone={type === 'ABSENT' ? 'bad' : type === 'OVERTIME' ? 'purple' : 'warn'}>{type.replace(/_/g, ' ').toLowerCase()} {count}</Chip>
            ))}
          </div>
          {can('attendance.update.all') ? <Button className="ml-auto" loading={recompute.isPending} onClick={() => recompute.mutate()}>Recompute period</Button> : null}
        </div>

        <Card>
          <DataTable
            rows={exceptions.data?.content ?? []}
            loading={exceptions.isLoading}
            columns={[
              { key: 'employee', header: 'Employee', render: (r) => r.employeeName },
              { key: 'date', header: 'Date', render: (r) => fmtDate(r.date), sortValue: (r) => r.date },
              { key: 'type', header: 'Type', render: (r) => <StatusBadge status={r.type} /> },
              { key: 'minutes', header: 'Minutes', align: 'right', render: (r) => r.minutes },
              {
                key: 'actions', header: '', align: 'right',
                render: (r) => (can('attendance.update.all') ? <Button size="sm" onClick={(e) => { e.stopPropagation(); setResolving(r) }}>Resolve</Button> : null),
              },
            ]}
          />
        </Card>
      </Tabs.Content>

      {correcting ? <CorrectionSheet row={correcting} saving={correct.isPending} onClose={() => setCorrecting(null)} onSave={(body) => correct.mutate({ id: correcting.id, ...body })} /> : null}
      {resolving ? <ResolveSheet row={resolving} saving={resolve.isPending} onClose={() => setResolving(null)} onSave={(body) => resolve.mutate({ id: resolving.id, ...body })} /> : null}
    </Tabs.Root>
  )
}

function CorrectionSheet({ row, onClose, onSave, saving }: { row: Attendance; onClose: () => void; onSave: (body: { checkIn?: string; checkOut?: string; editReason: string }) => void; saving: boolean }) {
  const [checkIn, setCheckIn] = React.useState(row.checkIn ? fmtTime(row.checkIn) : '09:00')
  const [checkOut, setCheckOut] = React.useState(row.checkOut ? fmtTime(row.checkOut) : '17:30')
  const [reason, setReason] = React.useState('')

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && onClose()}
      title="Correct attendance"
      description={`${row.employeeName} · ${fmtDate(row.workDate)}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} disabled={!reason.trim()} onClick={() => onSave({ checkIn, checkOut, editReason: reason })}>Save correction</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Check in"><TimeField value={checkIn} onChange={setCheckIn} /></Field>
          <Field label="Check out"><TimeField value={checkOut} onChange={setCheckOut} /></Field>
        </div>
        <Field label="Reason" required hint="Corrections are attributed to you in the audit log.">
          <TextArea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Employee forgot to punch out" />
        </Field>
      </div>
    </Sheet>
  )
}

function ResolveSheet({ row, onClose, onSave, saving }: { row: AttendanceException; onClose: () => void; onSave: (body: { checkOut?: string; reason: string }) => void; saving: boolean }) {
  const [mode, setMode] = React.useState<'scheduled' | 'custom'>('scheduled')
  const [checkOut, setCheckOut] = React.useState('17:30')
  const [reason, setReason] = React.useState('')

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && onClose()}
      title="Resolve exception"
      description={`${row.employeeName} · ${fmtDate(row.date)} · ${row.type.replace(/_/g, ' ').toLowerCase()}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} disabled={!reason.trim()} onClick={() => onSave({ checkOut: mode === 'scheduled' ? '17:30' : checkOut, reason })}>Resolve</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Resolution">
          <Select value={mode} onChange={setMode} options={[
            { value: 'scheduled', label: 'Set check-out to scheduled end', description: 'Uses the working schedule end time' },
            { value: 'custom', label: 'Set a custom check-out time' },
          ]} />
        </Field>
        {mode === 'custom' ? <Field label="Check out"><TimeField value={checkOut} onChange={setCheckOut} /></Field> : null}
        <Field label="Reason" required><TextArea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Confirmed with the employee's manager" /></Field>
      </div>
    </Sheet>
  )
}
