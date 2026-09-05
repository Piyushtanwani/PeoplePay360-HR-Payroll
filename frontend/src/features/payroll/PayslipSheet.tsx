import * as React from 'react'
import { Download } from 'lucide-react'
import { usePayslip, usePayslipVariance, useSavePayslipNote } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import {
  Button, Callout, Chip, DataTable, DetailList, Field, HelpItems, HelpPopover, Sheet, Spinner,
  StatusBadge, TabPanel, Tabs, TextArea, type Column,
} from '@/components/ui'
import { useDownload } from '@/lib/download'
import { fmtDateTime, fmtRange, moneyExact, num } from '@/lib/format'
import type { PayslipLine } from '@/api/types'

/** One payslip: how the figure was reached, how it moved, and the record behind it. */
export function PayslipSheet({ payslipId, onOpenChange }: {
  payslipId: number | null
  onOpenChange: (open: boolean) => void
}) {
  const { can } = useAuth()
  const payslip = usePayslip(payslipId)
  const variance = usePayslipVariance(payslipId, can('payslip.read.all'))
  const { download, pending: downloading } = useDownload()

  const [note, setNote] = React.useState('')
  const saveNote = useSavePayslipNote()
  React.useEffect(() => { setNote(payslip.data?.note ?? '') }, [payslip.data?.id, payslip.data?.note])

  const lineColumns: Column<PayslipLine & { id: string }>[] = [
    { key: 'sequence', header: 'Seq', align: 'right', width: '56px', render: (r) => r.sequence },
    {
      key: 'rule',
      header: 'Rule',
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.ruleName}</p>
          <p className="tnum truncate text-xs2 text-label2">{r.ruleCode}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (r) => (
        <span className={r.amount < 0 ? 'text-bad' : undefined}>{moneyExact(r.amount)}</span>
      ),
    },
  ]

  const lines = (payslip.data?.lines ?? []).map((l) => ({ ...l, id: `${l.sequence}-${l.ruleCode}` }))

  return (
    <Sheet
      open={payslipId !== null}
      onOpenChange={onOpenChange}
      width="lg"
      title={payslip.data ? `${payslip.data.employeeName} · ${fmtRange(payslip.data.periodStart, payslip.data.periodEnd)}` : 'Payslip'}
      description="Produced by a payrun and never edited afterwards. To change it, correct the data and recompute."
      footer={
        <>
          {payslip.data ? (
            <Button
              icon={<Download className="h-4 w-4" />}
              loading={downloading}
              onClick={() =>
                download(
                  `/api/payslips/${payslip.data!.id}/pdf`,
                  `Payslip_${payslip.data!.employeeNo}_${payslip.data!.periodStart}.pdf`,
                )
              }
            >
              Download PDF
            </Button>
          ) : null}
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </>
      }
    >
      {payslip.isLoading ? (
        <p className="flex items-center gap-2 text-sm2 text-label2"><Spinner /> Loading…</p>
      ) : payslip.isError || !payslip.data ? (
        <Callout tone="bad" title="Payslip not available">
          It may have been removed, or it is outside what your role may see.
        </Callout>
      ) : (
        <Tabs
          items={[
            { value: 'computation', label: 'How it was calculated' },
            { value: 'variance', label: 'Change since last time', hidden: !can('payslip.read.all') },
            { value: 'details', label: 'Record' },
          ]}
        >
          <TabPanel value="computation">
            <div className="space-y-4">
              <DetailList
                items={[
                  { label: 'Gross', value: moneyExact(payslip.data.gross), tnum: true },
                  { label: 'Deductions', value: moneyExact(payslip.data.deductions), tnum: true },
                  { label: 'Net', value: <span className="text-[15px]">{moneyExact(payslip.data.net)}</span>, tnum: true },
                ]}
              />

              <div>
                <div className="mb-2 flex items-center gap-1">
                  <h3 className="text-sm2 font-semibold">Rules, in the order they ran</h3>
                  <HelpPopover title="Reading the calculation" size="sm">
                    <HelpItems
                      items={[
                        { term: 'Order matters', text: 'Each rule may use the result of any rule above it, and none below.' },
                        { term: 'Categories', text: 'Basic and allowances add up to gross; deductions come off it.' },
                        { term: 'Negative lines', text: 'Shown in red. A deduction larger than gross would make net negative.' },
                      ]}
                    />
                  </HelpPopover>
                </div>
                <div className="rounded-card border border-separator">
                  <DataTable
                    rows={lines}
                    columns={lineColumns}
                    chrome="embedded"
                    groupBy={(r) => r.category}
                    summaryRow={{ rule: 'Net pay', amount: moneyExact(payslip.data.net) }}
                    empty={{ title: 'No lines', description: 'This payslip has no computed lines, which should not happen.' }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-1">
                  <h3 className="text-sm2 font-semibold">Inputs the rules used</h3>
                  <HelpPopover title="Where inputs come from" size="sm">
                    <HelpItems
                      items={[
                        { term: 'Computed', text: 'Derived from attendance, leave and the working schedule.' },
                        { term: 'Manual', text: 'Entered against the payrun, which overrides the computed value.' },
                      ]}
                    />
                  </HelpPopover>
                </div>
                <DetailList
                  items={payslip.data.inputs.map((input) => ({
                    label: input.code.replace(/_/g, ' ').toLowerCase(),
                    value: (
                      <span className="flex items-center justify-end gap-2">
                        <span className="tnum">{num(input.value, 2)}</span>
                        {input.source === 'MANUAL' ? <Chip tone="warn">manual</Chip> : null}
                      </span>
                    ),
                  }))}
                />
              </div>
            </div>
          </TabPanel>

          <TabPanel value="variance">
            {variance.isLoading ? (
              <p className="flex items-center gap-2 text-sm2 text-label2"><Spinner /> Comparing…</p>
            ) : !variance.data?.previousPayslipId ? (
              <Callout tone="neutral" title="Nothing to compare with">
                This is the first payslip for this person, so there is no previous one to measure against.
              </Callout>
            ) : (
              <div className="space-y-4">
                <DetailList
                  items={[
                    {
                      label: 'Change in net',
                      value: (
                        <span className={variance.data.netDelta < 0 ? 'text-bad' : 'text-ok'}>
                          {moneyExact(variance.data.netDelta, { sign: true })} ({variance.data.netDeltaPct}%)
                        </span>
                      ),
                      tnum: true,
                    },
                  ]}
                />
                <div className="rounded-card border border-separator">
                  <DataTable
                    rows={variance.data.lineDeltas.map((d) => ({ ...d, id: d.ruleCode }))}
                    chrome="embedded"
                    columns={[
                      { key: 'ruleCode', header: 'Rule', render: (r) => <span className="tnum">{r.ruleCode}</span> },
                      { key: 'previous', header: 'Previously', align: 'right', render: (r) => moneyExact(r.previous) },
                      { key: 'current', header: 'This time', align: 'right', render: (r) => moneyExact(r.current) },
                      {
                        key: 'delta',
                        header: 'Change',
                        align: 'right',
                        render: (r) => (
                          <span className={r.delta < 0 ? 'text-bad' : r.delta > 0 ? 'text-ok' : undefined}>
                            {r.delta === 0 ? '—' : moneyExact(r.delta, { sign: true })}
                          </span>
                        ),
                      },
                    ]}
                    empty={{ title: 'No line changes', description: 'Every rule produced the same amount as last time.' }}
                  />
                </div>
              </div>
            )}
          </TabPanel>

          <TabPanel value="details">
            <div className="space-y-4">
              <DetailList
                items={[
                  { label: 'Employee', value: `${payslip.data.employeeName} · ${payslip.data.employeeNo}` },
                  { label: 'Department', value: payslip.data.departmentName ?? '—' },
                  { label: 'Contract', value: payslip.data.contractReference ?? '—', tnum: true },
                  { label: 'Payrun', value: payslip.data.payrunName },
                  { label: 'Payrun status', value: <StatusBadge status={payslip.data.payrunState} /> },
                  { label: 'Period', value: fmtRange(payslip.data.periodStart, payslip.data.periodEnd) },
                  { label: 'Days worked', value: num(payslip.data.workedDays, 2), tnum: true },
                  { label: 'Days scheduled', value: num(payslip.data.scheduledDays, 2), tnum: true },
                  { label: 'Unpaid days', value: num(payslip.data.unpaidDays, 2), tnum: true },
                  { label: 'Payslip sent', value: <StatusBadge status={payslip.data.delivery?.status ?? 'NOT_SENT'} /> },
                  {
                    label: 'Sent at',
                    value: fmtDateTime(payslip.data.delivery?.sentAt),
                    hidden: !payslip.data.delivery?.sentAt,
                  },
                  { label: 'Sent to', value: payslip.data.delivery?.recipient ?? '—', hidden: !payslip.data.delivery?.recipient },
                ]}
              />
              {can('payslip.update.all') ? (
                <Field label="Internal note" hint="Visible to payroll staff only. It does not appear on the PDF.">
                  <TextArea value={note} onChange={(e) => setNote(e.target.value)} />
                  <Button
                    className="mt-2"
                    size="sm"
                    loading={saveNote.isPending}
                    onClick={() => payslip.data && saveNote.mutate({ id: payslip.data.id, note })}
                  >
                    Save note
                  </Button>
                </Field>
              ) : payslip.data.note ? (
                <DetailList items={[{ label: 'Note', value: payslip.data.note }]} />
              ) : null}
            </div>
          </TabPanel>
        </Tabs>
      )}
    </Sheet>
  )
}
