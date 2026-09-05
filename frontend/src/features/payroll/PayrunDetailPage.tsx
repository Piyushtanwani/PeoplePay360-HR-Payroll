import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Plus } from 'lucide-react'
import {
  useAddPayrunInput, useEmployeeOptions, useOverrideIssue, usePayrun, usePayrunAction, usePayrunDelivery,
  usePayrunIssues, usePayslips,
} from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import {
  Button, Callout, Card, CardHeader, Chip, ConfirmDialog, DataTable, DetailList, Field, HelpItems,
  HelpPopover, NumberInput, Select, Sheet, Skeleton, StatusBadge, StatusLegend, TabPanel,
  Tabs, TextArea, Tooltip, type Column,
} from '@/components/ui'
import { useDownload } from '@/lib/download'
import { fmtDateTime, fmtRange, money, moneyExact, num } from '@/lib/format'
import { useNumberParamState } from '@/lib/hooks/useSearchParamState'
import { useTableState } from '@/lib/hooks/useTableState'
import { PayslipSheet } from './PayslipSheet'
import type { PayrunIssue, Payslip } from '@/api/types'

const TIMELINE = ['DRAFT', 'COMPUTED', 'VALIDATED', 'PAID', 'SENT']

type Transition = 'compute' | 'validate' | 'pay' | 'send' | 'cancel'

export function PayrunDetailPage() {
  const { id } = useParams()
  const payrunId = Number(id)
  const { can } = useAuth()

  const payrun = usePayrun(payrunId)
  const issues = usePayrunIssues(payrunId)
  const { download, pending: downloading } = useDownload()

  const payslipsTable = useTableState({ prefix: 'ps.', defaultSort: 'employeeId', defaultDir: 'asc' })
  const payslips = usePayslips({ ...payslipsTable.params, payrunId })

  const run = payrun.data
  const queued = (run?.state === 'PAID' || run?.state === 'SENT') ?? false
  const delivery = usePayrunDelivery(payrunId, queued && (run?.payslipCount ?? 0) > 0)

  const action = usePayrunAction(payrunId)
  const override = useOverrideIssue(payrunId)
  const [confirm, setConfirm] = React.useState<Transition | null>(null)
  const [overriding, setOverriding] = React.useState<PayrunIssue | null>(null)
  const [addingInput, setAddingInput] = React.useState(false)
  const [payslipId, setPayslipId] = useNumberParamState('payslipId')

  if (payrun.isLoading) {
    return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-72" /></div>
  }
  if (!run) {
    return (
      <Callout tone="bad" title="Payrun not found">
        This payrun does not exist, or it is outside what your role may see.
      </Callout>
    )
  }

  const openBlockers = (issues.data ?? []).filter((i) => i.severity === 'BLOCKER' && i.status === 'OPEN')
  const openWarnings = (issues.data ?? []).filter((i) => i.severity === 'WARNING' && i.status === 'OPEN')
  const stateIndex = TIMELINE.indexOf(run.state)

  const confirmCopy: Record<Transition, { title: string; sentence: string; label: string; danger?: boolean }> = {
    compute: {
      title: 'Recompute this payrun?',
      sentence: `Every payslip in ${run.name} is recalculated from the current data. Any manual input already entered is kept.`,
      label: 'Recompute',
    },
    validate: {
      title: `Validate ${run.name}?`,
      sentence: `${num(run.payslipCount)} payslips totalling ${moneyExact(run.totalNet)} will be cleared for payment.`,
      label: 'Validate',
    },
    pay: {
      title: `Mark ${run.name} as paid?`,
      sentence: `This records that ${num(run.payslipCount)} people have been paid ${moneyExact(run.totalNet)} in total. It cannot be undone.`,
      label: 'Mark as paid',
    },
    send: {
      title: 'Send payslips?',
      sentence: `Each of the ${num(run.payslipCount)} people receives their payslip by email at their work address.`,
      label: 'Send payslips',
    },
    cancel: {
      title: `Cancel ${run.name}?`,
      sentence: 'Every payslip in this payrun is deleted. The people in it become available for another payrun covering the same period.',
      label: 'Cancel payrun',
      danger: true,
    },
  }

  const primaryAction = () => {
    if (run.state === 'DRAFT') {
      return can('payrun.compute') ? (
        <Button variant="primary" loading={action.isPending} onClick={() => action.mutate({ action: 'compute' })}>
          Compute payslips
        </Button>
      ) : (
        <Tooltip content="Computing a payrun needs the payrun.compute permission.">
          <span><Button variant="primary" disabled>Compute payslips</Button></span>
        </Tooltip>
      )
    }
    if (run.state === 'COMPUTED') {
      return (
        <span className="inline-flex gap-2">
          {can('payrun.compute') ? (
            <Button loading={action.isPending} onClick={() => setConfirm('compute')}>Recompute</Button>
          ) : null}
          {can('payrun.validate') ? (
            <Tooltip
              content={
                openBlockers.length
                  ? `${openBlockers.length} blocking issue${openBlockers.length === 1 ? '' : 's'} must be fixed or overridden first.`
                  : null
              }
            >
              <span>
                <Button variant="primary" disabled={openBlockers.length > 0} onClick={() => setConfirm('validate')}>
                  Validate
                </Button>
              </span>
            </Tooltip>
          ) : null}
        </span>
      )
    }
    if (run.state === 'VALIDATED' && can('payrun.pay')) {
      return <Button variant="primary" onClick={() => setConfirm('pay')}>Mark as paid</Button>
    }
    if ((run.state === 'PAID' || run.state === 'SENT') && can('payrun.send')) {
      return <Button variant="primary" onClick={() => setConfirm('send')}>Send payslips</Button>
    }
    return null
  }

  const issueColumns: Column<PayrunIssue>[] = [
    { key: 'severity', header: 'Severity', render: (r) => <StatusBadge status={r.severity} /> },
    {
      key: 'employee',
      header: 'Employee',
      render: (r) => (
        <Link to={`/employees/${r.employeeId}`} className="font-medium text-accent hover:underline">
          {r.employeeName}
        </Link>
      ),
    },
    {
      key: 'message',
      header: 'Issue',
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate">{r.message}</p>
          <p className="tnum truncate text-xs2 text-label2">{r.checkCode}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'State',
      render: (r) =>
        r.status === 'OVERRIDDEN' ? (
          <Tooltip content={r.overrideReason ?? 'Overridden'}>
            <span><StatusBadge status="OVERRIDDEN" tooltip={false} /></span>
          </Tooltip>
        ) : (
          <StatusBadge status={r.status} />
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '160px',
      render: (r) => (
        <span className="flex items-center justify-end gap-1">
          {r.fixLink ? (
            <Button size="sm" onClick={() => window.open(r.fixLink!, '_self')}>Fix</Button>
          ) : null}
          {r.status === 'OPEN' && can('payrun.override_issue') ? (
            r.overridable ? (
              <Button size="sm" onClick={() => setOverriding(r)}>Override</Button>
            ) : (
              <Tooltip content="This check cannot be overridden. The underlying problem has to be fixed.">
                <span><Button size="sm" disabled>Override</Button></span>
              </Tooltip>
            )
          ) : null}
        </span>
      ),
    },
  ]

  return (
    <>
      <Link to="/payroll/payruns" className="mb-3 inline-flex items-center gap-1.5 text-sm2 text-label2 hover:text-label">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to payruns
      </Link>

      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-d3 font-semibold tracking-[-0.01em]">{run.name}</h1>
              <StatusBadge status={run.state} />
            </div>
            <p className="mt-1 text-sm2 text-label2">
              {fmtRange(run.periodStart, run.periodEnd)} · {run.structureName} · {num(run.employeeCount)} employees
            </p>
          </div>
          <div className="flex items-center gap-2">
            {can('payrun.export') && run.payslipCount > 0 ? (
              <Button
                icon={<Download className="h-4 w-4" />}
                loading={downloading}
                onClick={() => download(`/api/payruns/${payrunId}/export.csv`, `payrun_${payrunId}.csv`)}
              >
                Export CSV
              </Button>
            ) : null}
            {primaryAction()}
            {can('payrun.delete') && !['PAID', 'SENT', 'CANCELLED'].includes(run.state) ? (
              <Button variant="danger" onClick={() => setConfirm('cancel')}>Cancel</Button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {TIMELINE.map((step, index) => (
            <span key={step} className="flex items-center gap-2">
              <Chip tone={index <= stateIndex ? 'ok' : 'neutral'}>{step.toLowerCase()}</Chip>
              {index < TIMELINE.length - 1 ? <span className="text-label2" aria-hidden>›</span> : null}
            </span>
          ))}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          {[
            ['Payslips', num(run.payslipCount)],
            ['Total gross', money(run.totalGross)],
            ['Total net', money(run.totalNet)],
            ['Paid on', run.paidAt ? fmtDateTime(run.paidAt) : 'Not yet'],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs2 text-label2">{label}</p>
              <p className="tnum mt-0.5 text-[17px] font-semibold">{value}</p>
            </div>
          ))}
        </div>
      </Card>

      {openBlockers.length > 0 ? (
        <Callout tone="bad" title={`${openBlockers.length} blocking issue${openBlockers.length === 1 ? '' : 's'}`}>
          This payrun cannot be validated until each one is fixed, or deliberately overridden with a reason.
        </Callout>
      ) : null}

      <div className="mt-4">
        <Tabs
          urlKey="tab"
          items={[
            { value: 'payslips', label: 'Payslips', count: payslips.data?.totalElements ?? null },
            {
              value: 'issues',
              label: 'Issues',
              count: openBlockers.length + openWarnings.length || null,
              countTone: openBlockers.length ? 'bad' : 'warn',
            },
            { value: 'delivery', label: 'Delivery', hidden: !queued },
          ]}
        >
          <TabPanel value="payslips">
            <Card>
              <CardHeader
                title="Payslips"
                subtitle="One per employee. Open any to see how the figure was reached."
                action={
                  can('payrun.update') && ['DRAFT', 'COMPUTED'].includes(run.state) ? (
                    <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAddingInput(true)}>
                      Add an input
                    </Button>
                  ) : undefined
                }
              />
              <DataTable
                rows={payslips.data?.content ?? []}
                columns={payslipColumns}
                table={payslipsTable}
                total={payslips.data?.totalElements}
                loading={payslips.isLoading}
                fetching={payslips.isFetching}
                onRowClick={(r) => setPayslipId(r.id)}
                toolbar={{ search: 'Search by name or number' }}
                empty={{
                  title: run.state === 'DRAFT' ? 'Not computed yet' : 'No payslips',
                  description:
                    run.state === 'DRAFT'
                      ? 'Compute the payrun to produce a payslip for each selected employee.'
                      : 'Nobody in this payrun produced a payslip, which usually means no valid contract.',
                }}
              />
            </Card>
          </TabPanel>

          <TabPanel value="issues">
            <Card>
              <CardHeader
                title="Pre-payment checks"
                subtitle="Run automatically when the payrun is computed."
                help={
                  <HelpPopover title="Blockers and warnings">
                    <HelpItems
                      items={[
                        { term: 'Blocker', text: 'Stops validation. Either fix the underlying data, or override it with a written reason.' },
                        { term: 'Warning', text: 'Worth a look, but it does not prevent payment.' },
                        { term: 'Cannot be overridden', text: 'Some checks, such as a duplicate payslip, have no safe override.' },
                        { term: 'After fixing', text: 'Recompute the payrun so the checks run again against the corrected data.' },
                      ]}
                    />
                  </HelpPopover>
                }
                action={<StatusLegend statuses={['BLOCKER', 'WARNING', 'OPEN', 'OVERRIDDEN']} />}
              />
              <DataTable
                rows={issues.data ?? []}
                columns={issueColumns}
                loading={issues.isLoading}
                empty={{
                  title: run.state === 'DRAFT' ? 'Not checked yet' : 'Nothing flagged',
                  description:
                    run.state === 'DRAFT'
                      ? 'The checks run when the payrun is computed.'
                      : 'Every check passed. This payrun can be validated and paid.',
                }}
              />
            </Card>
          </TabPanel>

          <TabPanel value="delivery">
            <Card>
              <CardHeader
                title="Payslip delivery"
                subtitle={
                  delivery.data
                    ? `${delivery.data.summary.sent ?? 0} sent · ${delivery.data.summary.queued ?? 0} queued · ${delivery.data.summary.failed ?? 0} failed · ${delivery.data.summary.skipped ?? 0} skipped`
                    : 'Loading…'
                }
              />
              <DataTable
                rows={(delivery.data?.rows ?? []).map((r) => ({ ...r, id: r.payslipId }))}
                loading={delivery.isLoading}
                columns={[
                  { key: 'employeeName', header: 'Employee', render: (r) => r.employeeName },
                  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                  { key: 'recipient', header: 'Sent to', render: (r) => r.recipient ?? 'No address on file' },
                  { key: 'sentAt', header: 'When', render: (r) => fmtDateTime(r.sentAt) },
                ]}
                empty={{ title: 'Nothing sent yet', description: 'Use "Send payslips" once the payrun has been paid.' }}
              />
            </Card>
          </TabPanel>
        </Tabs>
      </div>

      <PayslipSheet payslipId={payslipId} onOpenChange={(open) => !open && setPayslipId(null)} />

      <OverrideSheet
        issue={overriding}
        saving={override.isPending}
        onOpenChange={(open) => !open && setOverriding(null)}
        onSubmit={(reason) =>
          overriding && override.mutate({ issueId: overriding.id, reason }, { onSuccess: () => setOverriding(null) })
        }
      />

      <AddInputSheet
        open={addingInput}
        payrunId={payrunId}
        onOpenChange={setAddingInput}
      />

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm ? confirmCopy[confirm].title : ''}
        sentence={confirm ? confirmCopy[confirm].sentence : ''}
        confirmLabel={confirm ? confirmCopy[confirm].label : ''}
        tone={confirm && confirmCopy[confirm].danger ? 'danger' : 'primary'}
        typeToConfirm={confirm === 'cancel' ? run.name : undefined}
        loading={action.isPending}
        onConfirm={() =>
          confirm && action.mutate({ action: confirm }, { onSuccess: () => setConfirm(null) })
        }
      />
    </>
  )
}

const payslipColumns: Column<Payslip>[] = [
  {
    key: 'employeeId',
    header: 'Employee',
    sortable: true,
    render: (r) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{r.employeeName}</p>
        <p className="tnum truncate text-xs2 text-label2">{r.employeeNo}</p>
      </div>
    ),
  },
  { key: 'basic', header: 'Basic', align: 'right', sortable: true, render: (r) => money(r.basic) },
  { key: 'gross', header: 'Gross', align: 'right', sortable: true, render: (r) => money(r.gross) },
  { key: 'deductions', header: 'Deductions', align: 'right', sortable: true, render: (r) => money(r.deductions) },
  {
    key: 'net',
    header: 'Net',
    align: 'right',
    sortable: true,
    render: (r) => <span className={r.net < 0 ? 'font-semibold text-bad' : 'font-semibold'}>{money(r.net)}</span>,
  },
]

function OverrideSheet({ issue, saving, onOpenChange, onSubmit }: {
  issue: PayrunIssue | null
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = React.useState('')
  // Keyed on the issue's id rather than the object: a re-render carrying the same issue must not
  // wipe a reason somebody is halfway through typing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (issue) setReason('') }, [issue?.id])

  return (
    <Sheet
      open={issue !== null}
      onOpenChange={onOpenChange}
      title="Override this check"
      description="The payrun proceeds despite the issue. Your reason is kept on the record and on the audit trail."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" loading={saving} disabled={!reason.trim()} onClick={() => onSubmit(reason.trim())}>
            Override
          </Button>
        </>
      }
    >
      {issue ? (
        <div className="space-y-4">
          <DetailList
            items={[
              { label: 'Employee', value: issue.employeeName },
              { label: 'Check', value: issue.checkCode, tnum: true },
              { label: 'Severity', value: <StatusBadge status={issue.severity} /> },
              { label: 'What it says', value: issue.message },
            ]}
          />
          <Field label="Reason" required htmlFor="override-reason" hint="Why paying anyway is the right call.">
            <TextArea
              id="override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Bank details confirmed verbally; the record is being updated separately."
            />
          </Field>
        </div>
      ) : null}
    </Sheet>
  )
}

function AddInputSheet({ open, payrunId, onOpenChange }: {
  open: boolean
  payrunId: number
  onOpenChange: (open: boolean) => void
}) {
  const employees = useEmployeeOptions(open)
  const add = useAddPayrunInput(payrunId, () => onOpenChange(false))
  const [form, setForm] = React.useState({ employeeId: null as number | null, code: 'BONUS', value: 0 })
  React.useEffect(() => { if (open) setForm({ employeeId: null, code: 'BONUS', value: 0 }) }, [open])

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add a payroll input"
      description="Overrides a computed value for one person. Recompute the payrun to apply it."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            loading={add.isPending}
            disabled={!form.employeeId || !form.code.trim()}
            onClick={() =>
              form.employeeId &&
              add.mutate({ employeeId: form.employeeId, code: form.code.trim().toUpperCase(), value: form.value })
            }
          >
            Save input
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Employee" required>
          <Select
            value={form.employeeId}
            onChange={(v) => setForm({ ...form, employeeId: v })}
            options={(employees.data?.content ?? []).map((e) => ({
              value: e.id,
              label: e.displayName,
              description: e.employeeNo,
            }))}
            placeholder="Select employee"
          />
        </Field>
        <Field
          label="Input code"
          required
          hint="A rule reads this as I_CODE. Use an existing code to override it, or a new one for an extra value."
        >
          <Select
            value={form.code}
            onChange={(v) => setForm({ ...form, code: v })}
            options={[
              { value: 'BONUS', label: 'BONUS', description: 'An extra amount a rule can add.' },
              { value: 'OVERTIME_HOURS', label: 'OVERTIME_HOURS', description: 'Overrides the hours from attendance.' },
              { value: 'UNPAID_DAYS', label: 'UNPAID_DAYS', description: 'Overrides the unpaid days from leave.' },
              { value: 'WORKED_DAYS', label: 'WORKED_DAYS', description: 'Overrides the days worked from attendance.' },
            ]}
          />
        </Field>
        <Field label="Value" required>
          <NumberInput value={form.value} step={0.5} onChange={(v) => setForm({ ...form, value: v })} />
        </Field>
      </div>
    </Sheet>
  )
}
