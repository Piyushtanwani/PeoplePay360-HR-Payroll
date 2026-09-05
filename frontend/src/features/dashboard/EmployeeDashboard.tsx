import { Link } from 'react-router-dom'
import { CalendarDays, FileText, PartyPopper } from 'lucide-react'
import { useMyDashboard } from '@/api/hooks'
import {
  Button, Callout, Card, CardHeader, Chip, DetailList, HelpItems, HelpPopover, KpiCard, PageHeader,
  Skeleton, StatusBadge,
} from '@/components/ui'
import { fmtDate, fmtRange, money, num } from '@/lib/format'
import { QuickAction } from '../attendance/QuickAction'
import { LeaveBalanceCards } from '../employees/LeaveBalanceCards'

/**
 * An employee's home screen.
 *
 * Employees hold no dashboard permission, so the HR dashboard is a refusal for them and they used to
 * be redirected to the attendance page instead. This shows the four things they actually come here
 * for: whether they are checked in, how much leave they have, what they were last paid, and what is
 * coming up.
 */
export function EmployeeDashboard() {
  const dashboard = useMyDashboard()
  const data = dashboard.data

  if (dashboard.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      </div>
    )
  }

  if (dashboard.isError || !data) {
    return (
      <Callout tone="warn" title="Nothing to show yet">
        Your account is not linked to an employee record, so there is no attendance, leave or pay to show.
        Ask an administrator to link it.
      </Callout>
    )
  }

  return (
    <>
      <PageHeader
        title={`Hello, ${data.displayName.split(' ')[0]}`}
        description={[data.jobTitle, data.departmentName].filter(Boolean).join(' · ') || 'Your own attendance, leave and pay.'}
        help={
          <HelpPopover title="What is on this page">
            <HelpItems
              items={[
                { term: 'Today', text: 'Check in when you start and out when you finish. An entry left open counts as no worked time.' },
                { term: 'Leave balance', text: 'Available is what you can take now. Projected assumes every pending request is approved.' },
                { term: 'Payslips', text: 'Your last three. Open one to see exactly how the amount was reached.' },
                { term: 'Your contract', text: 'What payroll reads for you. The wage itself is on the Contracts page.' },
              ]}
            />
          </HelpPopover>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <QuickAction />

          <div className="grid gap-3 sm:grid-cols-2">
            <KpiCard
              label="Days worked this month"
              value={num(data.attendanceDaysThisMonth)}
              hint="Days with both a check-in and a check-out"
            />
            <KpiCard
              label="Days needing attention"
              value={num(data.exceptionsThisMonth)}
              tone={data.exceptionsThisMonth > 0 ? 'warn' : 'neutral'}
              hint={
                data.exceptionsThisMonth > 0
                  ? 'Late, absent or missing a check-out. Your manager can correct these.'
                  : 'Nothing outstanding this month'
              }
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[17px] font-semibold">Your leave balance</h2>
              <Link to="/timeoff" className="text-sm2 text-accent hover:underline">Request time off</Link>
            </div>
            <LeaveBalanceCards balances={data.leaveBalances} />
          </div>

          {data.pendingRequests.length ? (
            <Card>
              <CardHeader
                title="Waiting for a decision"
                subtitle="Requests you have submitted that nobody has approved or refused yet."
              />
              <div className="divide-y divide-separator">
                {data.pendingRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{request.typeName}</p>
                      <p className="truncate text-xs2 text-label2">
                        {fmtRange(request.startDate, request.endDate)} · {request.days}{' '}
                        {request.days === 1 ? 'day' : 'days'}
                      </p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={request.state} />
                      {request.anomaly ? <p className="mt-0.5 text-xs2 text-warn">{request.anomaly}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Recent payslips"
              subtitle="Open one to see how the amount was calculated."
              action={
                <Link to="/payroll/payslips">
                  <Button size="sm">See all</Button>
                </Link>
              }
            />
            {data.recentPayslips.length ? (
              <div className="divide-y divide-separator">
                {data.recentPayslips.map((payslip) => (
                  <Link
                    key={payslip.id}
                    to={`/payroll/payslips?payslipId=${payslip.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{fmtRange(payslip.periodStart, payslip.periodEnd)}</p>
                      <p className="truncate text-xs2 text-label2">{payslip.payrunState.toLowerCase()}</p>
                    </div>
                    <span className="tnum font-semibold">{money(payslip.net)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="flex items-center gap-2 px-5 py-6 text-sm2 text-label2">
                <FileText className="h-4 w-4" aria-hidden /> No payslips yet. They appear once payroll has run.
              </p>
            )}
          </Card>

          <Card>
            <CardHeader title="Your contract" subtitle="What payroll reads for you." />
            {data.contract ? (
              <DetailList
                bordered={false}
                items={[
                  { label: 'Reference', value: data.contract.reference, tnum: true },
                  { label: 'Job title', value: data.contract.jobTitle || '—' },
                  { label: 'Paid', value: data.contract.wageType?.toLowerCase() ?? '—' },
                  { label: 'Schedule', value: data.contract.scheduleName ?? '—' },
                  { label: 'Started', value: fmtDate(data.contract.startDate) },
                  { label: 'Ends', value: data.contract.endDate ? fmtDate(data.contract.endDate) : 'Open ended' },
                ]}
              />
            ) : (
              <div className="p-5">
                <Callout tone="warn" title="No contract in force">
                  Speak to HR. Without one you cannot be included in a payrun.
                </Callout>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Coming up" subtitle="Public holidays are not deducted from your leave." />
            {data.upcomingHolidays.length ? (
              <div className="divide-y divide-separator">
                {data.upcomingHolidays.map((holiday) => (
                  <div key={holiday.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="flex items-center gap-2 text-sm2">
                      <PartyPopper className="h-3.5 w-3.5 text-label2" aria-hidden />
                      {holiday.name}
                    </span>
                    <Chip>{fmtDate(holiday.date)}</Chip>
                  </div>
                ))}
              </div>
            ) : (
              <p className="flex items-center gap-2 px-5 py-6 text-sm2 text-label2">
                <CalendarDays className="h-4 w-4" aria-hidden /> No public holidays recorded ahead.
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
