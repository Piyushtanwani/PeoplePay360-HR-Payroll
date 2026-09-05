import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as Tabs from '@radix-ui/react-tabs'
import { ArrowLeft, Download, Lock, Plus } from 'lucide-react'
import { api, ApiError, buildUrl } from '@/api/client'
import { useEmployeeOptions } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import {
  Button, Callout, Card, CardHeader, Chip, ConfirmDialog, DataTable, EmptyState, Field, Select, Sheet,
  Skeleton, StatusBadge, TextArea, Tooltip, useToast,
} from '@/components/ui'
import { fmtDate, money, num } from '@/lib/format'
import type { Page, Payrun, PayrunIssue, Payslip } from '@/api/types'
import { PayslipSheet } from './PayslipSheet'

const TAB_CLASS = 'rounded-control px-3 py-1.5 text-sm2 font-medium text-label2 data-[state=active]:bg-surface data-[state=active]:text-label data-[state=active]:shadow-sm'
const TIMELINE: Payrun['state'][] = ['DRAFT', 'COMPUTED', 'VALIDATED', 'PAID', 'SENT']
const INPUT_CODES = [
  { value: 'UNPAID_DAYS', label: 'Unpaid days', description: 'Reduces worked days for this employee' },
  { value: 'OVERTIME_HOURS', label: 'Overtime hours' },
  { value: 'BONUS', label: 'Bonus amount' },
  { value: 'OTHER', label: 'Other' },
]

export function PayrunDetailPage() {
  const { id } = useParams()
  const payrunId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { can, token } = useAuth()
  const employees = useEmployeeOptions()

  const [confirm, setConfirm] = React.useState<null | 'validate' | 'pay' | 'send' | 'cancel'>(null)
  const [openPayslip, setOpenPayslip] = React.useState<number | null>(null)
  const [overriding, setOverriding] = React.useState<PayrunIssue | null>(null)
  const [addingInput, setAddingInput] = React.useState(false)

  const payrun = useQuery({ queryKey: ['payrun', payrunId], queryFn: () => api.get<Payrun>(`/api/payruns/${payrunId}`) })
  const payslips = useQuery({ queryKey: ['payslips', 'payrun', payrunId], queryFn: () => api.page<Payslip>('/api/payslips', { payrunId, size: 200 }) })
  const issues = useQuery({ queryKey: ['payrun', payrunId, 'issues'], queryFn: () => api.get<PayrunIssue[]>(`/api/payruns/${payrunId}/issues`) })

  const run = payrun.data
  const anyQueued = (payslips.data?.content ?? []).some((p) => p.delivery.status === 'QUEUED')

  const delivery = useQuery({
    queryKey: ['payrun', payrunId, 'delivery'],
    enabled: run?.state === 'SENT',
    refetchInterval: anyQueued ? 3000 : false,
    queryFn: () => api.get<{ rows: { payslipId: number; employeeName: string; status: string; sentAt: string | null; recipient: string | null }[]; summary: Record<string, number> }>(`/api/payruns/${payrunId}/delivery`),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['payrun', payrunId] })
    queryClient.invalidateQueries({ queryKey: ['payslips'] })
    queryClient.invalidateQueries({ queryKey: ['payruns'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const action = useMutation({
    mutationFn: (name: 'compute' | 'validate' | 'pay' | 'send' | 'cancel') => api.post(`/api/payruns/${payrunId}/${name}`),
    onSuccess: (_, name) => {
      invalidate()
      setConfirm(null)
      const messages: Record<string, string> = {
        compute: `${payslips.data?.totalElements ?? 0} payslips computed`,
        validate: 'Payrun validated',
        pay: 'Payrun marked as paid',
        send: 'Payslips queued for delivery',
        cancel: 'Payrun cancelled',
      }
      toast.push({ tone: 'success', title: messages[name] })
    },
    onError: (error) => {
      setConfirm(null)
      const apiError = error instanceof ApiError ? error : null
      toast.push({
        tone: 'error',
        title: apiError?.code === 'BLOCKERS_PRESENT' ? 'Blocking issues remain' : 'Action failed',
        detail: apiError?.detail,
        requestId: apiError?.requestId,
      })
    },
  })

  const override = useMutation({
    mutationFn: ({ issueId, reason }: { issueId: number; reason: string }) => api.post(`/api/payruns/${payrunId}/issues/${issueId}/override`, { reason }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payrun', payrunId] }); setOverriding(null); toast.push({ tone: 'success', title: 'Issue overridden' }) },
    onError: (error) => toast.push({ tone: 'error', title: 'Could not override', detail: error instanceof ApiError ? error.detail : '' }),
  })

  const addInput = useMutation({
    mutationFn: (body: { employeeId: number; code: string; value: number }) => api.post(`/api/payruns/${payrunId}/inputs`, body),
    onSuccess: () => { setAddingInput(false); toast.push({ tone: 'info', title: 'Input added', detail: 'Recompute the payrun to apply it.' }) },
  })

  const exportCsv = async () => {
    const response = await fetch(buildUrl(`/api/payruns/${payrunId}/export.csv`), { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `payrun_${payrunId}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (payrun.isLoading) return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-72" /></div>
  if (!run) return <Callout tone="bad" title="Payrun not found">This payrun does not exist or is outside your access scope.</Callout>

  const openBlockers = (issues.data ?? []).filter((i) => i.severity === 'BLOCKER' && i.status === 'OPEN')
  const stateIndex = TIMELINE.indexOf(run.state)

  const primaryAction = (() => {
    if (run.state === 'DRAFT' || run.state === 'COMPUTED') {
      if (run.state === 'DRAFT' && can('payrun.compute')) return <Button variant="primary" loading={action.isPending} onClick={() => action.mutate('compute')}>Compute payslips</Button>
      if (run.state === 'COMPUTED' && can('payrun.validate')) {
        return (
          <Tooltip content={openBlockers.length ? `${openBlockers.length} blocking issue(s) must be resolved` : null}>
            <span className="inline-flex gap-2">
              <Button loading={action.isPending} onClick={() => action.mutate('compute')}>Recompute</Button>
              <Button variant="primary" disabled={openBlockers.length > 0} onClick={() => setConfirm('validate')}>Validate</Button>
            </span>
          </Tooltip>
        )
      }
    }
    if (run.state === 'VALIDATED' && can('payrun.pay')) return <Button variant="primary" onClick={() => setConfirm('pay')}>Mark paid</Button>
    if ((run.state === 'PAID' || run.state === 'SENT') && can('payrun.send')) return <Button variant="primary" onClick={() => setConfirm('send')}>Send payslips</Button>
    return null
  })()

  return (
    <>
      <Link to="/payroll/payruns" className="mb-3 inline-flex items-center gap-1.5 text-sm2 text-label2 hover:text-label">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to payruns
      </Link>

      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-d3 font-semibold tracking-[-0.01em]">{run.name}</h1>
              <StatusBadge status={run.state} />
            </div>
            <p className="mt-1 text-sm2 text-label2">
              {run.structureName} · {fmtDate(run.periodStart)} — {fmtDate(run.periodEnd)} · created by {run.createdBy}
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm2">
              <span><span className="tnum font-semibold">{num(run.employeeCount)}</span> <span className="text-label2">employees</span></span>
              <span><span className="tnum font-semibold">{num(run.payslipCount)}</span> <span className="text-label2">payslips</span></span>
              <span><span className="tnum font-semibold">{money(run.totalGross, { compact: true })}</span> <span className="text-label2">gross</span></span>
              <span><span className="tnum font-semibold">{money(run.totalNet, { compact: true })}</span> <span className="text-label2">net</span></span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {can('payrun.update') && (run.state === 'DRAFT' || run.state === 'COMPUTED') ? (
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAddingInput(true)}>Add input</Button>
            ) : null}
            {can('payrun.export') ? <Button icon={<Download className="h-4 w-4" />} onClick={exportCsv}>Export CSV</Button> : null}
            {can('payrun.delete') && (run.state === 'DRAFT' || run.state === 'COMPUTED') ? <Button variant="danger" onClick={() => setConfirm('cancel')}>Cancel</Button> : null}
            {primaryAction}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-1.5">
          {TIMELINE.map((state, index) => (
            <React.Fragment key={state}>
              <span className={`rounded-full px-2.5 py-1 text-xs2 font-medium ${index <= stateIndex ? 'bg-accent/12 text-accent' : 'bg-surface2 text-label2'}`}>
                {state.toLowerCase()}
              </span>
              {index < TIMELINE.length - 1 ? <span className={`h-px w-6 ${index < stateIndex ? 'bg-accent/40' : 'bg-separator'}`} /> : null}
            </React.Fragment>
          ))}
        </div>
      </Card>

      {openBlockers.length ? (
        <Callout tone="bad" title={`${openBlockers.length} blocking issue${openBlockers.length === 1 ? '' : 's'}`}>
          Validation stays disabled until every blocker is resolved or the underlying data is fixed.
        </Callout>
      ) : null}

      <Tabs.Root defaultValue="payslips" className="mt-4">
        <Tabs.List className="mb-4 inline-flex gap-1 rounded-control bg-surface2 p-0.5">
          <Tabs.Trigger value="payslips" className={TAB_CLASS}>Payslips</Tabs.Trigger>
          <Tabs.Trigger value="issues" className={TAB_CLASS}>
            Issues {issues.data?.length ? <Chip tone={openBlockers.length ? 'bad' : 'warn'} className="ml-1.5">{issues.data.filter((i) => i.status === 'OPEN').length}</Chip> : null}
          </Tabs.Trigger>
          {run.state === 'SENT' ? <Tabs.Trigger value="delivery" className={TAB_CLASS}>Delivery</Tabs.Trigger> : null}
        </Tabs.List>

        <Tabs.Content value="payslips">
          <Card>
            <DataTable
              rows={payslips.data?.content ?? []}
              loading={payslips.isLoading}
              onRowClick={(row) => setOpenPayslip(row.id)}
              empty={<EmptyState title="No payslips yet" description="Compute the payrun to generate payslips for the selected employees." />}
              columns={[
                { key: 'employee', header: 'Employee', render: (r) => <span className="font-medium">{r.employeeName}</span>, sortValue: (r) => r.employeeName },
                {
                  key: 'warning', header: 'Warning',
                  render: (r) => {
                    const issue = (issues.data ?? []).find((i) => i.employeeId === r.employeeId && i.status === 'OPEN')
                    return issue ? <Chip tone={issue.severity === 'BLOCKER' ? 'bad' : 'warn'}>{issue.checkCode.replace(/_/g, ' ').toLowerCase()}</Chip> : <span className="text-label2">—</span>
                  },
                },
                { key: 'worked', header: 'Worked', align: 'right', render: (r) => r.workedDays },
                { key: 'basic', header: 'Basic', align: 'right', render: (r) => money(r.basic, { compact: true }) },
                { key: 'gross', header: 'Gross', align: 'right', render: (r) => money(r.gross, { compact: true }) },
                { key: 'net', header: 'Net', align: 'right', render: (r) => <span className="font-semibold">{money(r.net, { compact: true })}</span>, sortValue: (r) => r.net },
                { key: 'state', header: 'Status', render: (r) => <StatusBadge status={r.payrunState} /> },
              ]}
            />
          </Card>
        </Tabs.Content>

        <Tabs.Content value="issues">
          <div className="space-y-4">
            {(['BLOCKER', 'WARNING'] as const).map((severity) => {
              const rows = (issues.data ?? []).filter((i) => i.severity === severity)
              if (!rows.length) return null
              return (
                <Card key={severity}>
                  <CardHeader title={severity === 'BLOCKER' ? 'Blockers' : 'Warnings'} subtitle={severity === 'BLOCKER' ? 'These must be fixed before the payrun can be validated.' : 'Review before finalising; these do not block validation.'} />
                  <div className="divide-y divide-separator">
                    {rows.map((issue) => (
                      <div key={issue.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                        <div className="min-w-0">
                          <p className="text-sm2 font-medium">{issue.message}</p>
                          <p className="mt-0.5 flex items-center gap-2 text-xs2 text-label2">
                            <span className="tnum">{issue.checkCode}</span>
                            <StatusBadge status={issue.status === 'OPEN' ? severity : issue.status} />
                            {issue.overrideReason ? <span>· {issue.overrideReason}</span> : null}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {issue.fixLink ? <Link to={issue.fixLink}><Button size="sm">Fix</Button></Link> : null}
                          {issue.status === 'OPEN' && can('payrun.override_issue') ? (
                            issue.overridable ? (
                              <Button size="sm" onClick={() => setOverriding(issue)}>Override</Button>
                            ) : (
                              <Tooltip content="This check cannot be overridden. Fix the underlying data.">
                                <span className="grid h-8 w-8 place-items-center text-label2"><Lock className="h-3.5 w-3.5" /></span>
                              </Tooltip>
                            )
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )
            })}
            {!issues.data?.length ? <EmptyState title="No issues" description="Every payslip in this run passed validation." /> : null}
          </div>
        </Tabs.Content>

        <Tabs.Content value="delivery">
          <Card>
            <CardHeader
              title="Payslip delivery"
              subtitle={delivery.data ? `${delivery.data.summary.sent} sent · ${delivery.data.summary.queued} queued · ${delivery.data.summary.failed} failed · ${delivery.data.summary.skipped} skipped` : 'Loading delivery status…'}
            />
            <DataTable
              rows={(delivery.data?.rows ?? []).map((row) => ({ ...row, id: row.payslipId }))}
              loading={delivery.isLoading}
              columns={[
                { key: 'employee', header: 'Employee', render: (r) => r.employeeName },
                { key: 'recipient', header: 'Recipient', render: (r) => r.recipient ?? <span className="text-label2">No work email</span> },
                { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                { key: 'sent', header: 'Sent at', render: (r) => (r.sentAt ? fmtDate(r.sentAt) : '—') },
              ]}
            />
          </Card>
        </Tabs.Content>
      </Tabs.Root>

      {openPayslip ? <PayslipSheet payslipId={openPayslip} onClose={() => setOpenPayslip(null)} /> : null}

      <ConfirmDialog
        open={confirm === 'validate'}
        onOpenChange={() => setConfirm(null)}
        title="Validate payrun"
        sentence={`Validate ${run.name} for ${run.payslipCount} employees totalling ${money(run.totalNet)} net. Payslips become final for this period.`}
        confirmLabel="Validate payrun"
        loading={action.isPending}
        onConfirm={() => action.mutate('validate')}
      />
      <ConfirmDialog
        open={confirm === 'pay'}
        onOpenChange={() => setConfirm(null)}
        title="Mark payrun as paid"
        sentence={`Mark ${run.name} as paid for ${run.payslipCount} employees totalling ${money(run.totalNet)} net. This records the payment date and locks the run.`}
        confirmLabel="Mark as paid"
        loading={action.isPending}
        onConfirm={() => action.mutate('pay')}
      />
      <ConfirmDialog
        open={confirm === 'send'}
        onOpenChange={() => setConfirm(null)}
        title="Send payslips"
        sentence={`Send ${run.payslipCount} payslip PDFs for ${run.name} to each employee's work email. Employees without an address are skipped.`}
        confirmLabel="Send payslips"
        loading={action.isPending}
        onConfirm={() => action.mutate('send')}
      />
      <ConfirmDialog
        open={confirm === 'cancel'}
        onOpenChange={() => setConfirm(null)}
        title="Cancel payrun"
        tone="danger"
        typeToConfirm={run.name}
        sentence={`Cancelling ${run.name} deletes its ${run.payslipCount} payslips. This cannot be undone.`}
        confirmLabel="Cancel payrun"
        loading={action.isPending}
        onConfirm={() => action.mutate('cancel')}
      />

      {overriding ? (
        <OverrideSheet issue={overriding} saving={override.isPending} onClose={() => setOverriding(null)} onSave={(reason) => override.mutate({ issueId: overriding.id, reason })} />
      ) : null}

      {addingInput ? (
        <Sheet
          open
          onOpenChange={(next) => !next && setAddingInput(false)}
          title="Add payrun input"
          description="Inputs are applied the next time the payrun is computed."
          footer={<Button onClick={() => setAddingInput(false)}>Close</Button>}
        >
          <InputForm employees={(employees.data?.content ?? []).map((e) => ({ value: e.id, label: e.displayName, description: e.employeeNo }))} saving={addInput.isPending} onSubmit={(body) => addInput.mutate(body)} />
        </Sheet>
      ) : null}
    </>
  )
}

function OverrideSheet({ issue, onClose, onSave, saving }: { issue: PayrunIssue; onClose: () => void; onSave: (reason: string) => void; saving: boolean }) {
  const [reason, setReason] = React.useState('')
  return (
    <Sheet
      open
      onOpenChange={(next) => !next && onClose()}
      title="Override issue"
      description={issue.message}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} disabled={!reason.trim()} onClick={() => onSave(reason)}>Override issue</Button></>}
    >
      <Field label="Reason" required hint="The reason is stored with the payrun and shown in the audit log.">
        <TextArea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Confirmed with the employee's manager; leave will be recorded next period." />
      </Field>
    </Sheet>
  )
}

function InputForm({ employees, onSubmit, saving }: { employees: { value: number; label: string; description?: string }[]; onSubmit: (body: { employeeId: number; code: string; value: number }) => void; saving: boolean }) {
  const [employeeId, setEmployeeId] = React.useState<number | null>(null)
  const [code, setCode] = React.useState('BONUS')
  const [value, setValue] = React.useState(0)
  return (
    <div className="space-y-4">
      <Field label="Employee" required><Select value={employeeId} onChange={setEmployeeId} options={employees} placeholder="Select employee" /></Field>
      <Field label="Input code" required><Select value={code} onChange={setCode} options={INPUT_CODES} /></Field>
      <Field label="Value" required>
        <input type="number" value={value} onChange={(e) => setValue(Number(e.target.value))}
          className="tnum h-9 w-full rounded-control border border-separator bg-surface px-3 outline-none focus:border-accent" />
      </Field>
      <Button variant="primary" loading={saving} disabled={!employeeId} onClick={() => onSubmit({ employeeId: employeeId!, code, value })}>Add input</Button>
    </div>
  )
}
