import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import * as Tabs from '@radix-ui/react-tabs'
import { ArrowLeft, Eye, ShieldAlert } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import {
  Avatar, Button, Callout, Card, CardHeader, Chip, ConfirmDialog, DataTable, EmptyState, PageHeader,
  Skeleton, StatusBadge, Tooltip, useToast,
} from '@/components/ui'
import { fmtDate, fmtTime, minutesToHours, money } from '@/lib/format'
import type { Attendance, Contract, Employee, LeaveBalance, Page, TimeOffRequest } from '@/api/types'

const TAB_CLASS =
  'rounded-control px-3 py-1.5 text-sm2 font-medium text-label2 transition-colors data-[state=active]:bg-surface data-[state=active]:text-label data-[state=active]:shadow-sm'

export function EmployeeDetailPage() {
  const { id } = useParams()
  const employeeId = Number(id)
  const { can, employeeId: myEmployeeId } = useAuth()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'overview'
  const [revealing, setRevealing] = React.useState(false)
  const [revealed, setRevealed] = React.useState<{ bankName: string; accountNumber: string; ifsc: string } | null>(null)

  const employee = useQuery({ queryKey: ['employee', employeeId], queryFn: () => api.get<Employee>(`/api/employees/${employeeId}`) })
  const contracts = useQuery({ queryKey: ['contracts', employeeId], queryFn: () => api.get<Page<Contract>>('/api/contracts', { employeeId, size: 50 }) })
  const attendance = useQuery({ queryKey: ['attendance', employeeId], queryFn: () => api.get<Page<Attendance>>('/api/attendance', { employeeId, size: 30 }) })
  const requests = useQuery({ queryKey: ['timeoff', 'requests', employeeId], queryFn: () => api.get<Page<TimeOffRequest>>('/api/timeoff/requests', { employeeId, size: 50 }) })
  const balances = useQuery({ queryKey: ['timeoff', 'balances', employeeId], queryFn: () => api.get<LeaveBalance[]>('/api/timeoff/balances', { employeeId }) })

  const reveal = useMutation({
    mutationFn: () => api.get<{ bankName: string; accountNumber: string; ifsc: string }>(`/api/employees/${employeeId}/bank-account/unmask`),
    onSuccess: (data) => { setRevealed(data); setRevealing(false); toast.push({ tone: 'info', title: 'Bank details revealed', detail: 'This action has been written to the audit log.' }) },
    onError: (error) => toast.push({ tone: 'error', title: 'Could not reveal details', detail: error instanceof ApiError ? error.detail : '' }),
  })

  if (employee.isLoading) return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-72" /></div>
  if (employee.isError) return <Callout tone="bad" title="Employee not found">This record does not exist, or it is outside your access scope.</Callout>

  const person = employee.data!
  const activeContract = contracts.data?.content.find((c) => c.isActiveNow)

  return (
    <>
      <Link to="/employees" className="mb-3 inline-flex items-center gap-1.5 text-sm2 text-label2 hover:text-label">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to employees
      </Link>

      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={person.displayName} color={person.avatarColor} size={56} />
            <div>
              <h1 className="text-d3 font-semibold tracking-[-0.01em]">{person.displayName}</h1>
              <p className="text-sm2 text-label2">{person.jobTitle} · {person.departmentName}</p>
              <p className="tnum mt-0.5 text-xs2 text-label2">{person.employeeNo} · {person.workEmail}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ['Contracts', person.counts.contracts, 'contracts'],
              ['Attendance', person.counts.attendance, 'attendance'],
              ['Time off', person.counts.timeOffRequests, 'timeoff'],
              ['Allocations', person.counts.allocations, 'timeoff'],
            ].map(([label, count, target]) => (
              <button key={label as string} onClick={() => setSearchParams({ tab: target as string })}
                className="rounded-control border border-separator bg-surface px-3 py-2 text-left transition-colors hover:bg-surface2">
                <p className="tnum text-[17px] font-semibold">{count as number}</p>
                <p className="text-xs2 text-label2">{label as string}</p>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Tabs.Root value={tab} onValueChange={(value) => setSearchParams({ tab: value })}>
        <Tabs.List className="mb-4 inline-flex gap-1 rounded-control bg-surface2 p-0.5">
          <Tabs.Trigger value="overview" className={TAB_CLASS}>Overview</Tabs.Trigger>
          <Tabs.Trigger value="contracts" className={TAB_CLASS}>Contracts</Tabs.Trigger>
          <Tabs.Trigger value="attendance" className={TAB_CLASS}>Attendance</Tabs.Trigger>
          <Tabs.Trigger value="timeoff" className={TAB_CLASS}>Time off</Tabs.Trigger>
          <Tabs.Trigger value="bank" className={TAB_CLASS}>Bank</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Work information" />
              <dl className="divide-y divide-separator">
                {[
                  ['Department', person.departmentName],
                  ['Job position', person.jobTitle],
                  ['Manager', person.managerName ?? '—'],
                  ['Employee type', person.employeeType.replace('_', ' ').toLowerCase()],
                  ['Working schedule', person.workingScheduleName ?? '—'],
                  ['Hire date', fmtDate(person.hireDate)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 px-5 py-2.5 text-sm2">
                    <dt className="text-label2">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card>
              <CardHeader title="Active contract" subtitle="Payroll uses the contract applicable to the selected period." />
              {activeContract ? (
                <dl className="divide-y divide-separator">
                  {[
                    ['Reference', activeContract.reference],
                    ['Wage / month', activeContract.wage !== null ? money(activeContract.wage) : 'Hidden for your role'],
                    ['Salary structure', activeContract.salaryStructureName ?? '—'],
                    ['Start date', fmtDate(activeContract.startDate)],
                    ['End date', activeContract.endDate ? fmtDate(activeContract.endDate) : 'Open ended'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 px-5 py-2.5 text-sm2">
                      <dt className="text-label2">{label}</dt>
                      <dd className="text-right font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <EmptyState title="No running contract" description="This employee will be excluded from payroll until a contract is active." />
              )}
            </Card>
          </div>
        </Tabs.Content>

        <Tabs.Content value="contracts">
          <Card>
            <CardHeader title="Contracts" subtitle="History is retained; the running contract drives payroll." />
            <DataTable
              rows={contracts.data?.content ?? []}
              loading={contracts.isLoading}
              columns={[
                { key: 'ref', header: 'Reference', render: (r) => <span className="tnum font-medium">{r.reference}</span> },
                { key: 'start', header: 'Start', render: (r) => fmtDate(r.startDate) },
                { key: 'end', header: 'End', render: (r) => (r.endDate ? fmtDate(r.endDate) : '—') },
                { key: 'wage', header: 'Wage / month', align: 'right', render: (r) => (r.wage !== null ? money(r.wage) : '—') },
                { key: 'structure', header: 'Structure', render: (r) => r.salaryStructureName ?? '—' },
                { key: 'state', header: 'Status', render: (r) => <div className="flex items-center gap-1.5"><StatusBadge status={r.state} />{r.isActiveNow ? <Chip tone="ok">Active now</Chip> : null}</div> },
              ]}
            />
          </Card>
        </Tabs.Content>

        <Tabs.Content value="attendance">
          <Card>
            <CardHeader title="Attendance" subtitle="Last 30 records for this employee." />
            <DataTable
              rows={attendance.data?.content ?? []}
              loading={attendance.isLoading}
              columns={[
                { key: 'date', header: 'Date', render: (r) => fmtDate(r.workDate) },
                { key: 'in', header: 'Check in', render: (r) => fmtTime(r.checkIn) },
                { key: 'out', header: 'Check out', render: (r) => fmtTime(r.checkOut) },
                { key: 'worked', header: 'Worked', align: 'right', render: (r) => minutesToHours(r.workedMinutes) },
                { key: 'scheduled', header: 'Scheduled', align: 'right', render: (r) => minutesToHours(r.scheduledMinutes) },
                { key: 'status', header: 'Status', render: (r) => <div className="flex items-center gap-1.5"><StatusBadge status={r.status} />{r.isManualEdit ? <Tooltip content={r.editReason ?? 'Manually corrected'}><span><Chip tone="warn">edited</Chip></span></Tooltip> : null}</div> },
              ]}
            />
          </Card>
        </Tabs.Content>

        <Tabs.Content value="timeoff">
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {(balances.data ?? []).map((balance) => (
                <Card key={balance.typeId} className="p-4">
                  <p className="text-sm2 text-label2">{balance.typeName}</p>
                  <p className="tnum mt-1 text-d3 font-semibold">{balance.available} days</p>
                  <p className="tnum mt-1 text-xs2 text-label2">
                    {balance.allocated} allocated · {balance.taken} taken · {balance.pending} pending
                  </p>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader title="Time off requests" />
              <DataTable
                rows={requests.data?.content ?? []}
                loading={requests.isLoading}
                columns={[
                  { key: 'type', header: 'Type', render: (r) => r.typeName },
                  { key: 'start', header: 'Start', render: (r) => fmtDate(r.startDate) },
                  { key: 'end', header: 'End', render: (r) => fmtDate(r.endDate) },
                  { key: 'days', header: 'Duration', align: 'right', render: (r) => `${r.days} day${r.days === 1 ? '' : 's'}` },
                  { key: 'state', header: 'Status', render: (r) => <StatusBadge status={r.state} /> },
                ]}
              />
            </Card>
          </div>
        </Tabs.Content>

        <Tabs.Content value="bank">
          <Card className="max-w-xl">
            <CardHeader title="Bank account" subtitle="Masked by default. Revealing writes an audit entry." />
            <div className="space-y-3 p-5">
              {!person.bankAccount ? (
                <Callout tone="warn" title="No bank account on file">
                  Payroll will raise a blocking issue for this employee until an account is added.
                </Callout>
              ) : (
                <>
                  <div className="flex justify-between text-sm2"><span className="text-label2">Bank</span><span className="font-medium">{person.bankAccount.bankName}</span></div>
                  <div className="flex justify-between text-sm2">
                    <span className="text-label2">Account</span>
                    <span className="tnum font-medium">{revealed ? revealed.accountNumber : `•••• •••• ${person.bankAccount.accountLast4}`}</span>
                  </div>
                  {revealed ? <div className="flex justify-between text-sm2"><span className="text-label2">IFSC</span><span className="tnum font-medium">{revealed.ifsc}</span></div> : null}
                  {can('employee.read.sensitive') ? (
                    <Button icon={<Eye className="h-4 w-4" />} onClick={() => setRevealing(true)} disabled={Boolean(revealed)}>
                      {revealed ? 'Revealed' : 'Reveal full account'}
                    </Button>
                  ) : (
                    <p className="flex items-center gap-1.5 text-xs2 text-label2"><ShieldAlert className="h-3.5 w-3.5" /> Requires employee.read.sensitive</p>
                  )}
                  {myEmployeeId === employeeId ? (
                    <p className="text-xs2 text-label2">You cannot edit your own bank account. Ask another administrator.</p>
                  ) : null}
                </>
              )}
            </div>
          </Card>
        </Tabs.Content>
      </Tabs.Root>

      <ConfirmDialog
        open={revealing}
        onOpenChange={setRevealing}
        title="Reveal bank account"
        sentence={`Revealing the full account number for ${person.displayName} is recorded in the audit log against your name.`}
        confirmLabel="Reveal and record"
        loading={reveal.isPending}
        onConfirm={() => reveal.mutate()}
      />
    </>
  )
}
