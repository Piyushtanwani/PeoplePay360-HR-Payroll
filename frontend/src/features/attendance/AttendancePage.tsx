import * as React from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, CheckCircle2, Pencil, RefreshCw } from 'lucide-react'
import {
  useAttendance, useAttendanceExceptions, useDepartments, useEmployeeOptions, useRecomputeAttendance,
} from '@/api/hooks'
import { ATTENDANCE_STATUS_OPTIONS, EXCEPTION_TYPE_OPTIONS } from '@/api/constants'
import { useAuth } from '@/auth/AuthProvider'
import {
  Button, Card, Chip, ConfirmDialog, DataTable, DateRangePicker, IconButton,
  PageHeader, Select, StatusBadge, TabPanel, Tabs, Tooltip, type Column,
} from '@/components/ui'
import { currentPeriod, daysAgo, recentPeriods, todayIso } from '@/lib/dates'
import { fmtDate, fmtPeriod, fmtTime, minutesToHours } from '@/lib/format'
import { useNumberParamState, useSearchParamState } from '@/lib/hooks/useSearchParamState'
import { useTableState } from '@/lib/hooks/useTableState'
import { AttendanceHelp, AttendanceLegend } from './AttendanceHelp'
import { CorrectionSheet } from './CorrectionSheet'
import { QuickAction } from './QuickAction'
import { ResolveSheet } from './ResolveSheet'
import type { Attendance, AttendanceException } from '@/api/types'

export function AttendancePage() {
  const { can } = useAuth()
  const seesEveryone = can('attendance.read.all')
  const canCheckIn = can('attendance.create.own')

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Attendance"
        description={
          seesEveryone
            ? 'Recorded check-in and check-out times, and the exceptions to clear before a payrun.'
            : 'Your own recorded times. Check in when you start and out when you finish.'
        }
        help={<AttendanceHelp />}
      />
      {canCheckIn ? <QuickAction /> : null}
      {seesEveryone ? <HrAttendance /> : <OwnAttendance />}
    </div>
  )
}

/** What an employee sees: their own history. */
function OwnAttendance() {
  const table = useTableState({ defaultSort: 'workDate', defaultDir: 'desc' })
  const list = useAttendance(table.params)

  return (
    <Card>
        <DataTable
          rows={list.data?.content ?? []}
          columns={ownColumns}
          table={table}
          total={list.data?.totalElements}
          loading={list.isLoading}
          fetching={list.isFetching}
          error={list.error}
          onRetry={() => list.refetch()}
          toolbar={{ actions: <AttendanceLegend /> }}
          empty={{
            icon: <CalendarCheck className="h-6 w-6" />,
            title: 'Nothing recorded yet',
            description: 'Your days appear here once you check in and out.',
          }}
        />
      </Card>
  )
}

const ownColumns: Column<Attendance>[] = [
  { key: 'workDate', header: 'Date', sortable: true, render: (r) => fmtDate(r.workDate) },
  { key: 'checkIn', header: 'Check in', sortable: true, render: (r) => fmtTime(r.checkIn) },
  { key: 'checkOut', header: 'Check out', sortable: true, render: (r) => fmtTime(r.checkOut) },
  { key: 'workedMinutes', header: 'Worked', align: 'right', sortable: true, render: (r) => minutesToHours(r.workedMinutes) },
  { key: 'scheduledMinutes', header: 'Scheduled', align: 'right', sortable: true, render: (r) => minutesToHours(r.scheduledMinutes) },
  { key: 'status', header: 'Status', sortable: true, render: (r) => <StatusBadge status={r.status} /> },
]

/** What HR sees: everyone's records, and the exception queue. */
function HrAttendance() {
  const { can, employeeId: myEmployeeId } = useAuth()
  const departments = useDepartments()
  const employees = useEmployeeOptions()
  const canEdit = can('attendance.update.all')

  const [tab] = useSearchParamState<string>('tab', 'records')
  const [departmentId, setDepartmentId] = useNumberParamState('departmentId')
  const [employeeId, setEmployeeId] = useNumberParamState('employeeId')
  const [status, setStatus] = useSearchParamState<string>('status', '')
  const [range, setRange] = React.useState({ from: daysAgo(30), to: todayIso() })

  const [period, setPeriod] = useSearchParamState<string>('period', currentPeriod())
  const [type, setType] = useSearchParamState<string>('type', '')
  const [showResolved, setShowResolved] = useSearchParamState<string>('resolved', 'false')

  const recordsTable = useTableState({ defaultSort: 'workDate', defaultDir: 'desc' })
  const exceptionsTable = useTableState({ prefix: 'ex.', defaultSort: 'date', defaultDir: 'desc' })

  const records = useAttendance(
    { ...recordsTable.params, departmentId, employeeId, status: status || undefined, from: range.from, to: range.to },
    tab === 'records',
  )
  const exceptions = useAttendanceExceptions(
    {
      ...exceptionsTable.params,
      period,
      departmentId,
      employeeId,
      type: type || undefined,
      resolved: showResolved === 'all' ? undefined : showResolved === 'true',
    },
    tab === 'exceptions',
  )

  const [correcting, setCorrecting] = React.useState<Attendance | null>(null)
  const [resolving, setResolving] = React.useState<AttendanceException | null>(null)
  const [recomputing, setRecomputing] = React.useState(false)
  const recompute = useRecomputeAttendance()

  const sharedFilters = (
    <>
      <Select
        value={departmentId}
        onChange={setDepartmentId}
        clearable
        onClear={() => setDepartmentId(null)}
        placeholder="All departments"
        className="w-48"
        options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
      />
      <Select
        value={employeeId}
        onChange={setEmployeeId}
        clearable
        onClear={() => setEmployeeId(null)}
        placeholder="All employees"
        className="w-52"
        options={(employees.data?.content ?? []).map((e) => ({ value: e.id, label: e.displayName, description: e.employeeNo }))}
      />
    </>
  )

  const recordColumns: Column<Attendance>[] = [
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
    { key: 'workDate', header: 'Date', sortable: true, render: (r) => fmtDate(r.workDate) },
    { key: 'checkIn', header: 'Check in', sortable: true, render: (r) => fmtTime(r.checkIn) },
    { key: 'checkOut', header: 'Check out', sortable: true, render: (r) => fmtTime(r.checkOut) },
    { key: 'workedMinutes', header: 'Worked', align: 'right', sortable: true, render: (r) => minutesToHours(r.workedMinutes) },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={r.status} />
          {r.isManualEdit ? (
            <Tooltip content={r.editReason ?? 'Corrected by hand'}>
              <span><Chip tone="warn">edited</Chip></span>
            </Tooltip>
          ) : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '56px',
      hidden: !canEdit,
      render: (r) =>
        r.employeeId === myEmployeeId ? (
          <Tooltip content="Nobody may correct their own attendance, including administrators.">
            <span><IconButton label="Correct" disabled><Pencil className="h-3.5 w-3.5" /></IconButton></span>
          </Tooltip>
        ) : (
          <span onClick={(e) => e.stopPropagation()}>
            <IconButton label={`Correct ${r.employeeName}'s record`} onClick={() => setCorrecting(r)}>
              <Pencil className="h-3.5 w-3.5" />
            </IconButton>
          </span>
        ),
    },
  ]

  const exceptionColumns: Column<AttendanceException>[] = [
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
    { key: 'date', header: 'Date', sortable: true, render: (r) => fmtDate(r.date) },
    { key: 'type', header: 'Exception', sortable: true, render: (r) => <StatusBadge status={r.type} /> },
    {
      key: 'minutes',
      header: 'Minutes',
      align: 'right',
      sortable: true,
      tooltip: 'Minutes late, minutes of overtime, or the scheduled minutes missed by an absence.',
      render: (r) => (r.minutes ? r.minutes : '—'),
    },
    {
      key: 'resolved',
      header: 'State',
      sortable: true,
      render: (r) =>
        r.resolved ? (
          <Tooltip content={r.resolutionNote ?? 'Resolved'}>
            <span><StatusBadge status="RESOLVED" tooltip={false} /></span>
          </Tooltip>
        ) : (
          <StatusBadge status="OPEN" />
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '110px',
      hidden: !canEdit,
      render: (r) =>
        r.resolved ? null : r.employeeId === myEmployeeId ? (
          <Tooltip content="Nobody may resolve an exception on their own record.">
            <span><Button size="sm" disabled>Resolve</Button></span>
          </Tooltip>
        ) : (
          <span onClick={(e) => e.stopPropagation()}>
            <Button size="sm" icon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => setResolving(r)}>
              Resolve
            </Button>
          </span>
        ),
    },
  ]

  return (
    <>
      <Tabs
        urlKey="tab"
        items={[
          { value: 'records', label: 'Records' },
          {
            value: 'exceptions',
            label: 'Exceptions',
            count: exceptions.data?.totalElements ?? null,
            countTone: (exceptions.data?.totalElements ?? 0) > 0 ? 'warn' : 'neutral',
          },
        ]}
      >
        <TabPanel value="records">
          <Card>
            <DataTable
              rows={records.data?.content ?? []}
              columns={recordColumns}
              table={recordsTable}
              total={records.data?.totalElements}
              loading={records.isLoading}
              fetching={records.isFetching}
              error={records.error}
              onRetry={() => records.refetch()}
              toolbar={{
                search: 'Search by name or number',
                filters: (
                  <>
                    {sharedFilters}
                    <Select
                      value={status}
                      onChange={setStatus}
                      options={ATTENDANCE_STATUS_OPTIONS}
                      className="w-48"
                    />
                    <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
                  </>
                ),
                actions: <AttendanceLegend />,
              }}
              empty={{
                icon: <CalendarCheck className="h-6 w-6" />,
                title: 'No attendance in this range',
                description: 'Widen the dates, or clear the filters. Records appear as people check in and out.',
              }}
            />
          </Card>
        </TabPanel>

        <TabPanel value="exceptions">
          <Card>
            <DataTable
              rows={exceptions.data?.content ?? []}
              columns={exceptionColumns}
              table={exceptionsTable}
              total={exceptions.data?.totalElements}
              loading={exceptions.isLoading}
              fetching={exceptions.isFetching}
              error={exceptions.error}
              onRetry={() => exceptions.refetch()}
              toolbar={{
                filters: (
                  <>
                    <Select
                      value={period}
                      onChange={setPeriod}
                      className="w-44"
                      options={recentPeriods(12).map((p) => ({ value: p, label: fmtPeriod(p) }))}
                    />
                    {sharedFilters}
                    <Select value={type} onChange={setType} options={EXCEPTION_TYPE_OPTIONS} className="w-48" />
                    <Select
                      value={showResolved}
                      onChange={setShowResolved}
                      className="w-44"
                      options={[
                        { value: 'false', label: 'Open only' },
                        { value: 'true', label: 'Resolved only' },
                        { value: 'all', label: 'All exceptions' },
                      ]}
                    />
                  </>
                ),
                actions: canEdit ? (
                  <Button icon={<RefreshCw className="h-4 w-4" />} onClick={() => setRecomputing(true)}>
                    Recompute period
                  </Button>
                ) : undefined,
              }}
              empty={{
                icon: <CheckCircle2 className="h-6 w-6" />,
                title: showResolved === 'false' ? 'Nothing to clear' : 'No exceptions in this period',
                description:
                  showResolved === 'false'
                    ? 'Every exception in this period has been resolved. Payroll can proceed.'
                    : 'Exceptions appear when a day does not classify as a straightforward present.',
              }}
            />
          </Card>
        </TabPanel>
      </Tabs>

      <CorrectionSheet record={correcting} onOpenChange={(open) => !open && setCorrecting(null)} />
      <ResolveSheet exception={resolving} onOpenChange={(open) => !open && setResolving(null)} />

      <ConfirmDialog
        open={recomputing}
        onOpenChange={setRecomputing}
        title={`Recompute ${fmtPeriod(period)}?`}
        sentence="Statuses and exceptions are rebuilt from the recorded times, picking up any schedule or holiday changes. Resolutions already made are kept."
        confirmLabel="Recompute"
        loading={recompute.isPending}
        onConfirm={() => recompute.mutate(period, { onSuccess: () => setRecomputing(false) })}
      />
    </>
  )
}
