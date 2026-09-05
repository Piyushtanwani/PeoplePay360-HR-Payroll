import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Eye, KeyRound, Pencil, ShieldAlert } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import {
  useAttendance, useContracts, useCreateLogin, useEmployee, useLeaveBalances, useSetBankAccount,
  useTimeOffRequests, useUpdateEmployee,
} from '@/api/hooks'
import { ROLE_OPTIONS } from '@/api/constants'
import { useAuth } from '@/auth/AuthProvider'
import {
  ActiveBadge, Avatar, Button, Callout, Card, CardHeader, Chip, ConfirmDialog, DataTable, DetailList,
  Field, HelpItems, HelpPopover, Select, Sheet, Skeleton, StatusBadge, StatusLegend,
  TabPanel, Tabs, TextInput, Tooltip, useToast,
} from '@/components/ui'
import { fmtDate, fmtTime, minutesToHours, money, moneyExact } from '@/lib/format'
import { useSearchParamState } from '@/lib/hooks/useSearchParamState'
import { useTableState } from '@/lib/hooks/useTableState'
import { EmployeeSheet } from './EmployeeSheet'
import { LeaveBalanceCards } from './LeaveBalanceCards'

export function EmployeeDetailPage() {
  const { id } = useParams()
  const employeeId = Number(id)
  const navigate = useNavigate()
  const { can, employeeId: myEmployeeId } = useAuth()
  const toast = useToast()
  const isSelf = myEmployeeId === employeeId

  const [tab] = useSearchParamState<string>('tab', 'overview')
  const employee = useEmployee(employeeId)

  const contractsTable = useTableState({ prefix: 'c.', defaultSort: 'startDate', defaultDir: 'desc', size: 20 })
  const attendanceTable = useTableState({ prefix: 'a.', defaultSort: 'workDate', defaultDir: 'desc', size: 20 })
  const timeOffTable = useTableState({ prefix: 't.', defaultSort: 'startDate', defaultDir: 'desc', size: 20 })

  const contracts = useContracts({ ...contractsTable.params, employeeId }, tab === 'contracts' || tab === 'overview')
  const attendance = useAttendance({ ...attendanceTable.params, employeeId }, tab === 'attendance')
  const requests = useTimeOffRequests({ ...timeOffTable.params, employeeId }, tab === 'timeoff')
  const balances = useLeaveBalances(employeeId, tab === 'timeoff')

  const [editing, setEditing] = React.useState(false)
  const [issuingLogin, setIssuingLogin] = React.useState(false)
  const [editingBank, setEditingBank] = React.useState(false)
  const [revealing, setRevealing] = React.useState(false)
  const [revealed, setRevealed] = React.useState<{ bankName: string; accountNumber: string; ifsc: string } | null>(null)

  const update = useUpdateEmployee(() => setEditing(false))
  const createLogin = useCreateLogin(() => setIssuingLogin(false))
  const saveBank = useSetBankAccount(() => setEditingBank(false))

  const reveal = useMutation({
    mutationFn: () =>
      api.get<{ bankName: string; accountNumber: string; ifsc: string }>(`/api/employees/${employeeId}/bank-account/unmask`),
    onSuccess: (data) => {
      setRevealed(data)
      setRevealing(false)
      toast.push({ tone: 'info', title: 'Bank details revealed', detail: 'This has been written to the audit log against your name.' })
    },
    onError: (error) =>
      toast.push({
        tone: 'error',
        title: 'The details could not be revealed',
        detail: error instanceof ApiError ? error.detail : '',
      }),
  })

  if (employee.isLoading) {
    return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-72" /></div>
  }
  if (employee.isError || !employee.data) {
    return (
      <Callout tone="bad" title="Employee not found">
        This record does not exist, or it is outside what your role may see.
      </Callout>
    )
  }

  const person = employee.data
  const activeContract = contracts.data?.content.find((c) => c.isActiveNow)

  return (
    <>
      <Link to="/employees" className="mb-3 inline-flex items-center gap-1.5 text-sm2 text-label2 hover:text-label">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to employees
      </Link>

      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={person.displayName} color={person.avatarColor} size={56} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-d3 font-semibold tracking-[-0.01em]">{person.displayName}</h1>
                <ActiveBadge active={person.active} />
              </div>
              <p className="text-sm2 text-label2">
                {[person.jobTitle, person.departmentName].filter(Boolean).join(' · ') || 'No job title yet'}
              </p>
              <p className="tnum mt-0.5 text-xs2 text-label2">
                {person.employeeNo}
                {person.workEmail ? ` · ${person.workEmail}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {person.roleCode ? (
              <Chip tone="accent">{ROLE_OPTIONS.find((r) => r.value === person.roleCode)?.label ?? person.roleCode}</Chip>
            ) : can('employee.update.all') && can('user.create') ? (
              <Button icon={<KeyRound className="h-4 w-4" />} onClick={() => setIssuingLogin(true)}>
                Create login
              </Button>
            ) : (
              <Tooltip content="This person cannot sign in. An administrator can create a login for them.">
                <span><Chip>No login</Chip></span>
              </Tooltip>
            )}
            {can('employee.update.all') ? (
              <Button variant="primary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <Tabs
        urlKey="tab"
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'contracts', label: 'Contracts', count: person.counts.contracts },
          { value: 'attendance', label: 'Attendance', count: person.counts.attendance },
          { value: 'timeoff', label: 'Time off', count: person.counts.timeOffRequests },
          { value: 'bank', label: 'Bank' },
        ]}
      >
        <TabPanel value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Work details" />
              <DetailList
                bordered={false}
                items={[
                  { label: 'Department', value: person.departmentName ?? '—' },
                  { label: 'Job title', value: person.jobTitle || '—' },
                  { label: 'Manager', value: person.managerName ?? '—' },
                  { label: 'Employment type', value: person.employeeType.replace('_', ' ').toLowerCase() },
                  {
                    label: 'Working schedule',
                    value: person.workingScheduleName ?? '—',
                    hint: 'Decides how many days and hours each period expects.',
                  },
                  { label: 'Hire date', value: fmtDate(person.hireDate) },
                  { label: 'Sign-in role', value: person.roleCode ?? 'No login' },
                ]}
              />
            </Card>

            <Card>
              <CardHeader
                title="Contract in force"
                subtitle="This is what payroll reads. Details above do not affect pay."
                help={
                  <HelpPopover title="Why the contract matters">
                    <HelpItems
                      items={[
                        { term: 'One at a time', text: 'Contracts may not overlap, so a period always resolves to exactly one.' },
                        { term: 'Wage and structure', text: 'Both come from here, not from the employee record.' },
                        { term: 'No contract', text: 'Payroll raises a blocking issue and the person is not paid.' },
                      ]}
                    />
                  </HelpPopover>
                }
              />
              {activeContract ? (
                <DetailList
                  bordered={false}
                  items={[
                    { label: 'Reference', value: activeContract.reference, tnum: true },
                    {
                      label: 'Wage',
                      value: activeContract.wage !== null ? moneyExact(activeContract.wage) : 'Not visible to your role',
                      tnum: true,
                    },
                    { label: 'Salary structure', value: activeContract.salaryStructureName ?? '—' },
                    { label: 'Started', value: fmtDate(activeContract.startDate) },
                    { label: 'Ends', value: activeContract.endDate ? fmtDate(activeContract.endDate) : 'Open ended' },
                  ]}
                />
              ) : (
                <div className="p-5">
                  <Callout tone="warn" title="No contract in force">
                    This person cannot be paid until a running contract covers the payroll period.
                    {can('contract.create.all') ? (
                      <Button className="mt-2" size="sm" onClick={() => navigate(`/contracts?employeeId=${employeeId}`)}>
                        Add a contract
                      </Button>
                    ) : null}
                  </Callout>
                </div>
              )}
            </Card>
          </div>
        </TabPanel>

        <TabPanel value="contracts">
          <Card>
            <CardHeader title="Contracts" subtitle="History is kept. The running contract is the one payroll uses." />
            <DataTable
              rows={contracts.data?.content ?? []}
              columns={[
                { key: 'reference', header: 'Reference', sortable: true, render: (r) => <span className="tnum font-medium">{r.reference}</span> },
                { key: 'startDate', header: 'Start', sortable: true, render: (r) => fmtDate(r.startDate) },
                { key: 'endDate', header: 'End', sortable: true, render: (r) => (r.endDate ? fmtDate(r.endDate) : 'Open ended') },
                { key: 'wage', header: 'Wage', align: 'right', sortable: true, render: (r) => (r.wage !== null ? money(r.wage) : '—') },
                { key: 'structure', header: 'Salary structure', render: (r) => r.salaryStructureName ?? '—' },
                {
                  key: 'state',
                  header: 'Status',
                  sortable: true,
                  render: (r) => (
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={r.state} />
                      {r.isActiveNow ? <Chip tone="ok">In force</Chip> : null}
                    </div>
                  ),
                },
              ]}
              table={contractsTable}
              total={contracts.data?.totalElements}
              loading={contracts.isLoading}
              fetching={contracts.isFetching}
              onRowClick={(r) => navigate(`/contracts?contractId=${r.id}&employeeId=${employeeId}`)}
              empty={{
                title: 'No contracts yet',
                description: 'Without a contract this person cannot be included in a payrun.',
              }}
            />
          </Card>
        </TabPanel>

        <TabPanel value="attendance">
          <Card>
            <CardHeader
              title="Attendance"
              subtitle="Raw check-in and check-out records, newest first."
              action={<StatusLegend statuses={['PRESENT', 'LATE', 'OVERTIME', 'ABSENT', 'MISSING_CHECKOUT']} />}
            />
            <DataTable
              rows={attendance.data?.content ?? []}
              columns={[
                { key: 'workDate', header: 'Date', sortable: true, render: (r) => fmtDate(r.workDate) },
                { key: 'checkIn', header: 'Check in', sortable: true, render: (r) => fmtTime(r.checkIn) },
                { key: 'checkOut', header: 'Check out', sortable: true, render: (r) => fmtTime(r.checkOut) },
                { key: 'workedMinutes', header: 'Worked', align: 'right', sortable: true, render: (r) => minutesToHours(r.workedMinutes) },
                { key: 'scheduledMinutes', header: 'Scheduled', align: 'right', sortable: true, render: (r) => minutesToHours(r.scheduledMinutes) },
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
              ]}
              table={attendanceTable}
              total={attendance.data?.totalElements}
              loading={attendance.isLoading}
              fetching={attendance.isFetching}
              empty={{
                title: 'No attendance recorded',
                description: 'Records appear as this person checks in and out, or when someone adds them by hand.',
              }}
            />
          </Card>
        </TabPanel>

        <TabPanel value="timeoff">
          <div className="grid gap-4">
            <LeaveBalanceCards balances={balances.data ?? []} loading={balances.isLoading} />
            <Card>
              <CardHeader title="Leave requests" subtitle="Days are counted from the working schedule, excluding public holidays." />
              <DataTable
                rows={requests.data?.content ?? []}
                columns={[
                  { key: 'type', header: 'Type', render: (r) => r.typeName },
                  { key: 'startDate', header: 'Start', sortable: true, render: (r) => fmtDate(r.startDate) },
                  { key: 'endDate', header: 'End', sortable: true, render: (r) => fmtDate(r.endDate) },
                  { key: 'days', header: 'Days', align: 'right', sortable: true, render: (r) => r.days },
                  { key: 'state', header: 'Status', sortable: true, render: (r) => <StatusBadge status={r.state} /> },
                ]}
                table={timeOffTable}
                total={requests.data?.totalElements}
                loading={requests.isLoading}
                fetching={requests.isFetching}
                empty={{ title: 'No leave requested', description: 'Requests this person submits appear here.' }}
              />
            </Card>
          </div>
        </TabPanel>

        <TabPanel value="bank">
          <Card className="max-w-xl">
            <CardHeader
              title="Bank account"
              subtitle="Masked by default. The full number is encrypted, and revealing it is recorded."
            />
            <div className="space-y-3 p-5">
              {!person.bankAccount ? (
                <Callout tone="warn" title="No bank account on file">
                  Payroll raises a blocking issue for this person until an account is added.
                </Callout>
              ) : (
                <DetailList
                  items={[
                    { label: 'Bank', value: person.bankAccount.bankName },
                    {
                      label: 'Account',
                      value: revealed ? revealed.accountNumber : `•••• •••• ${person.bankAccount.accountLast4}`,
                      tnum: true,
                    },
                    { label: 'IFSC', value: revealed?.ifsc ?? '••••••', tnum: true, hidden: !revealed },
                  ]}
                />
              )}
              <div className="flex flex-wrap items-center gap-2">
                {can('employee.read.sensitive') && person.bankAccount ? (
                  <Button icon={<Eye className="h-4 w-4" />} onClick={() => setRevealing(true)} disabled={Boolean(revealed)}>
                    {revealed ? 'Revealed' : 'Reveal full account'}
                  </Button>
                ) : null}
                {can('employee.update.all') ? (
                  isSelf ? (
                    <Tooltip content="Change your own bank details from your profile, where your password is re-checked.">
                      <span>
                        <Button disabled>{person.bankAccount ? 'Update details' : 'Add details'}</Button>
                      </span>
                    </Tooltip>
                  ) : (
                    <Button variant={person.bankAccount ? 'secondary' : 'primary'} onClick={() => setEditingBank(true)}>
                      {person.bankAccount ? 'Update details' : 'Add bank details'}
                    </Button>
                  )
                ) : null}
              </div>
              {!can('employee.read.sensitive') && person.bankAccount ? (
                <p className="flex items-center gap-1.5 text-xs2 text-label2">
                  <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                  Revealing the full number needs the employee.read.sensitive permission.
                </p>
              ) : null}
            </div>
          </Card>
        </TabPanel>
      </Tabs>

      <EmployeeSheet
        open={editing}
        onOpenChange={setEditing}
        employee={person}
        saving={update.isPending}
        onSubmit={(body) => update.mutate({ id: employeeId, body })}
      />

      <LoginSheet
        open={issuingLogin}
        onOpenChange={setIssuingLogin}
        person={person.displayName}
        email={person.workEmail}
        saving={createLogin.isPending}
        onSubmit={(roleCode) => createLogin.mutate({ id: employeeId, roleCode })}
      />

      <BankSheet
        open={editingBank}
        onOpenChange={setEditingBank}
        person={person.displayName}
        saving={saveBank.isPending}
        onSubmit={(body) => saveBank.mutate({ id: employeeId, ...body })}
      />

      <ConfirmDialog
        open={revealing}
        onOpenChange={setRevealing}
        title="Reveal the full account number"
        sentence={`Revealing ${person.displayName}'s account number writes an entry to the audit log against your name.`}
        confirmLabel="Reveal and record"
        loading={reveal.isPending}
        onConfirm={() => reveal.mutate()}
      />
    </>
  )
}

function LoginSheet({ open, onOpenChange, person, email, saving, onSubmit }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: string
  email: string | null
  saving: boolean
  onSubmit: (roleCode: string) => void
}) {
  const [roleCode, setRoleCode] = React.useState<string | null>(null)
  React.useEffect(() => { if (open) setRoleCode(null) }, [open])

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Create a login for ${person}`}
      description="They receive an invite and choose their own password. Nobody else ever sees it."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" loading={saving} disabled={!roleCode || !email} onClick={() => roleCode && onSubmit(roleCode)}>
            Create login and send invite
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!email ? (
          <Callout tone="warn" title="No work email">
            Add a work email to this person first. The invite has nowhere to go without one.
          </Callout>
        ) : (
          <DetailList items={[{ label: 'Invite goes to', value: email }]} />
        )}
        <Field label="Role" required hint="One role per person. Extra permissions can be granted on top later.">
          <Select value={roleCode} onChange={setRoleCode} options={ROLE_OPTIONS} placeholder="Select a role" />
        </Field>
      </div>
    </Sheet>
  )
}

function BankSheet({ open, onOpenChange, person, saving, onSubmit }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: string
  saving: boolean
  onSubmit: (body: { bankName: string; accountNumber: string; ifsc?: string }) => void
}) {
  const [form, setForm] = React.useState({ bankName: '', accountNumber: '', confirm: '', ifsc: '' })
  React.useEffect(() => { if (open) setForm({ bankName: '', accountNumber: '', confirm: '', ifsc: '' }) }, [open])

  const mismatch = form.confirm.length > 0 && form.accountNumber !== form.confirm
  const valid = form.bankName.trim() && form.accountNumber.replace(/\s/g, '').length >= 4 && !mismatch && form.confirm

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Bank details for ${person}`}
      description="Only the last four digits are stored in the clear. The change is recorded in the audit log."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!valid}
            onClick={() => onSubmit({ bankName: form.bankName.trim(), accountNumber: form.accountNumber, ifsc: form.ifsc || undefined })}
          >
            Save bank details
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Bank name" required htmlFor="bank-name">
          <TextInput id="bank-name" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
        </Field>
        <Field label="Account number" required htmlFor="bank-account">
          <TextInput
            id="bank-account"
            autoComplete="off"
            value={form.accountNumber}
            onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
          />
        </Field>
        <Field
          label="Re-enter the account number"
          required
          htmlFor="bank-confirm"
          error={mismatch ? 'The two numbers do not match.' : undefined}
          hint={mismatch ? undefined : 'Typed twice, because a wrong digit here sends someone’s wages elsewhere.'}
        >
          <TextInput
            id="bank-confirm"
            autoComplete="off"
            value={form.confirm}
            invalid={mismatch}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </Field>
        <Field label="IFSC" htmlFor="bank-ifsc">
          <TextInput id="bank-ifsc" value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value })} />
        </Field>
      </div>
    </Sheet>
  )
}
