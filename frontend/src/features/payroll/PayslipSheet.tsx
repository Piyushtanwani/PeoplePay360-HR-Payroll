import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import * as Tabs from '@radix-ui/react-tabs'
import { Download } from 'lucide-react'
import { api, buildUrl } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import { Button, Chip, Sheet, StatusBadge, useToast } from '@/components/ui'
import { fmtDate, money } from '@/lib/format'
import type { Payslip } from '@/api/types'

const TAB_CLASS = 'rounded-control px-3 py-1.5 text-sm2 font-medium text-label2 data-[state=active]:bg-surface data-[state=active]:text-label data-[state=active]:shadow-sm'

interface Variance {
  previousPayslipId: number | null
  netDelta: number
  netDeltaPct: number
  lineDeltas: { ruleCode: string; ruleName: string; previous: number; current: number; delta: number }[]
}

export function PayslipSheet({ payslipId, onClose }: { payslipId: number; onClose: () => void }) {
  const toast = useToast()
  const { can, token } = useAuth()
  const [downloading, setDownloading] = React.useState(false)

  const payslip = useQuery({ queryKey: ['payslip', payslipId], queryFn: () => api.get<Payslip>(`/api/payslips/${payslipId}`) })
  const variance = useQuery({
    queryKey: ['payslip', payslipId, 'variance'],
    enabled: can('payslip.read.all'),
    queryFn: () => api.get<Variance>(`/api/payslips/${payslipId}/variance`),
  })

  const download = async () => {
    setDownloading(true)
    try {
      const response = await fetch(buildUrl(`/api/payslips/${payslipId}/pdf`), { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Payslip_${payslip.data?.employeeNo}_${payslip.data?.periodStart.slice(0, 7)}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.push({ tone: 'success', title: 'Payslip downloaded' })
    } catch {
      toast.push({ tone: 'error', title: 'Download failed', detail: 'The payslip PDF could not be generated.' })
    } finally {
      setDownloading(false)
    }
  }

  const slip = payslip.data
  const grouped = ['BASIC', 'ALLOWANCE', 'GROSS', 'DEDUCTION', 'NET'] as const

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && onClose()}
      width="lg"
      title={slip ? `Payslip · ${slip.employeeName}` : 'Payslip'}
      description={slip ? `${slip.employeeNo} · ${fmtDate(slip.periodStart)} — ${fmtDate(slip.periodEnd)}` : undefined}
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" icon={<Download className="h-4 w-4" />} loading={downloading} onClick={download}>Download PDF</Button>
        </>
      }
    >
      {!slip ? null : (
        <Tabs.Root defaultValue="computation">
          <Tabs.List className="mb-4 inline-flex gap-1 rounded-control bg-surface2 p-0.5">
            <Tabs.Trigger value="computation" className={TAB_CLASS}>Computation</Tabs.Trigger>
            {can('payslip.read.all') ? <Tabs.Trigger value="variance" className={TAB_CLASS}>Variance</Tabs.Trigger> : null}
            <Tabs.Trigger value="details" className={TAB_CLASS}>Details</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="computation">
            <div className="mb-4 grid grid-cols-3 gap-2 text-center">
              {[['Worked days', slip.workedDays], ['Scheduled days', slip.scheduledDays], ['Unpaid days', slip.unpaidDays]].map(([label, value]) => (
                <div key={label as string} className="rounded-control bg-surface2 px-3 py-2">
                  <p className="tnum text-[17px] font-semibold">{value as number}</p>
                  <p className="text-xs2 text-label2">{label as string}</p>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-card border border-separator">
              <table className="w-full text-body">
                <thead>
                  <tr className="border-b border-separator text-left text-xs2 uppercase tracking-wide text-label2">
                    <th className="px-4 py-2">Rule</th><th className="px-4 py-2">Code</th><th className="px-4 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map((category) => {
                    const lines = slip.lines.filter((l) => l.category === category)
                    if (!lines.length) return null
                    return (
                      <React.Fragment key={category}>
                        <tr className="bg-surface2/60">
                          <td colSpan={3} className="px-4 py-1.5 text-xs2 font-semibold uppercase tracking-wide text-label2">{category.toLowerCase()}</td>
                        </tr>
                        {lines.map((line) => (
                          <tr key={line.ruleCode} className="border-b border-separator/60">
                            <td className="px-4 py-2">{line.ruleName}</td>
                            <td className="tnum px-4 py-2 text-label2">{line.ruleCode}</td>
                            <td className={`tnum px-4 py-2 text-right ${line.amount < 0 ? 'text-bad' : ''}`}>{money(line.amount)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    )
                  })}
                  <tr className="bg-surface2">
                    <td className="px-4 py-2.5 font-semibold" colSpan={2}>Net salary</td>
                    <td className="tnum px-4 py-2.5 text-right text-[17px] font-semibold">{money(slip.net)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {slip.inputs.length ? (
              <div className="mt-4">
                <p className="mb-1.5 text-sm2 font-medium">Payrun inputs</p>
                <div className="flex flex-wrap gap-1.5">
                  {slip.inputs.map((input) => <Chip key={input.code} tone="accent">{input.code}: {input.value}</Chip>)}
                </div>
              </div>
            ) : null}
          </Tabs.Content>

          <Tabs.Content value="variance">
            {variance.data?.previousPayslipId ? (
              <>
                <div className="mb-3 flex items-center gap-2 text-sm2">
                  <span className="text-label2">Net change versus previous period</span>
                  <Chip tone={variance.data.netDelta >= 0 ? 'ok' : 'bad'}>
                    {variance.data.netDelta >= 0 ? '+' : ''}{money(variance.data.netDelta)} ({variance.data.netDeltaPct}%)
                  </Chip>
                </div>
                <div className="overflow-hidden rounded-card border border-separator">
                  <table className="w-full text-body">
                    <thead>
                      <tr className="border-b border-separator text-left text-xs2 uppercase tracking-wide text-label2">
                        <th className="px-4 py-2">Rule</th><th className="px-4 py-2 text-right">Previous</th>
                        <th className="px-4 py-2 text-right">Current</th><th className="px-4 py-2 text-right">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variance.data.lineDeltas.map((line) => (
                        <tr key={line.ruleCode} className="border-b border-separator/60">
                          <td className="px-4 py-2">{line.ruleName}</td>
                          <td className="tnum px-4 py-2 text-right text-label2">{money(line.previous)}</td>
                          <td className="tnum px-4 py-2 text-right">{money(line.current)}</td>
                          <td className={`tnum px-4 py-2 text-right ${line.delta === 0 ? 'text-label2' : line.delta > 0 ? 'text-ok' : 'text-bad'}`}>
                            {line.delta > 0 ? '+' : ''}{money(line.delta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-sm2 text-label2">No earlier payslip exists for this employee.</p>
            )}
          </Tabs.Content>

          <Tabs.Content value="details">
            <dl className="divide-y divide-separator rounded-card border border-separator">
              {[
                ['Employee', slip.employeeName], ['Department', slip.departmentName], ['Contract', slip.contractReference],
                ['Payrun', slip.payrunName], ['Period', `${fmtDate(slip.periodStart)} — ${fmtDate(slip.periodEnd)}`],
                ['Gross', money(slip.gross)], ['Deductions', money(slip.deductions)], ['Net', money(slip.net)],
                ['Delivery', slip.delivery.recipient ?? 'No recipient'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 px-4 py-2.5 text-sm2">
                  <dt className="text-label2">{label}</dt><dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 px-4 py-2.5 text-sm2">
                <dt className="text-label2">Delivery status</dt><dd><StatusBadge status={slip.delivery.status} /></dd>
              </div>
            </dl>
          </Tabs.Content>
        </Tabs.Root>
      )}
    </Sheet>
  )
}
