import * as React from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ArrowUpRight } from 'lucide-react'
import { useDepartments, useHrDashboard } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import {
  Callout, Card, CardHeader, Chip, DataTable, EmptyState, HelpItems, HelpPopover, KpiCard, MonthPicker,
  PageHeader, Select, Skeleton,
} from '@/components/ui'
import { lastClosedPeriod } from '@/lib/dates'
import { fmtPeriod, money, moneyCompact, num, pct } from '@/lib/format'
import { useNumberParamState, useSearchParamState } from '@/lib/hooks/useSearchParamState'

/**
 * The HR and payroll dashboard.
 *
 * What appears depends on what the caller may see, and the server decides that rather than the page
 * hiding figures it was sent. Someone without payroll rights is never sent a salary total at all.
 */
export function DashboardPage() {
  const { can } = useAuth()
  const showsPayroll = can('dashboard.read.payroll')
  const isAdmin = can('user.read')

  const [period, setPeriod] = useSearchParamState<string>('period', lastClosedPeriod())
  const [departmentId, setDepartmentId] = useNumberParamState('departmentId')
  const departments = useDepartments()
  const query = useHrDashboard({ period, departmentId }, true)
  const data = query.data

  const title = isAdmin ? 'Overview' : showsPayroll ? 'Payroll dashboard' : 'HR dashboard'

  return (
    <>
      <PageHeader
        title={title}
        description={
          showsPayroll
            ? `Pay, staffing, leave and attendance for ${fmtPeriod(period)}.`
            : `Staffing, leave and attendance for ${fmtPeriod(period)}.`
        }
        help={
          <HelpPopover title="Where these figures come from">
            <HelpItems
              items={[
                { term: 'The period', text: 'Everything is for the month selected, not the year to date.' },
                { term: 'Pay figures', text: 'Only payslips on a payrun that has been paid or sent. Draft and computed runs are excluded.' },
                { term: 'Attendance health', text: 'The share of recorded days that were worked, rather than absent or unclosed.' },
                { term: 'Redaction', text: 'A role without payroll rights is not sent the figures at all, rather than being shown blanks.' },
                { term: 'Freshness', text: 'Refreshed quietly about once a minute while this page is open.' },
              ]}
            />
          </HelpPopover>
        }
        actions={
          <div className="flex items-center gap-2">
            <MonthPicker value={period} onChange={setPeriod} className="w-48" />
            <Select
              value={departmentId}
              onChange={setDepartmentId}
              clearable
              onClear={() => setDepartmentId(null)}
              placeholder="All departments"
              className="w-48"
              options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
            />
          </div>
        }
      />

      {query.isError ? (
        <Callout tone="bad" title="The dashboard could not be loaded">
          The server did not respond as expected. The figures below may be out of date.
        </Callout>
      ) : null}

      {/* Headline figures. Payroll ones are simply absent for a role that may not see them. */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="People"
          value={num(data?.headcount)}
          loading={query.isLoading}
          hint="Active employees matching the filters"
        />
        {showsPayroll ? (
          <>
            <KpiCard
              label="Paid this period"
              value={moneyCompact(data?.kpis.totalNetPaid)}
              loading={query.isLoading}
              hint={`${num(data?.kpis.payslipsGenerated)} payslips`}
              help={
                <HelpPopover title="Total net paid" size="sm">
                  <p>Net pay across every payslip on a payrun that has been paid or sent for this period.</p>
                </HelpPopover>
              }
            />
            <KpiCard
              label="Average net"
              value={moneyCompact(data?.kpis.averageSalary)}
              loading={query.isLoading}
              hint="Per payslip in this period"
            />
          </>
        ) : (
          <>
            <KpiCard
              label="Awaiting a decision"
              value={num(data?.pendingApprovals)}
              tone={(data?.pendingApprovals ?? 0) > 0 ? 'warn' : 'neutral'}
              loading={query.isLoading}
              hint="Leave requests nobody has answered"
            />
            <KpiCard
              label="Attendance to clear"
              value={num(data?.openExceptions)}
              tone={(data?.openExceptions ?? 0) > 0 ? 'warn' : 'neutral'}
              loading={query.isLoading}
              hint="Unresolved exceptions this period"
            />
          </>
        )}
        <KpiCard
          label="Attendance health"
          value={pct(data?.kpis.attendanceHealthPct, 1)}
          loading={query.isLoading}
          tone={(data?.kpis.attendanceHealthPct ?? 100) < 90 ? 'warn' : 'ok'}
          hint="Recorded days that were actually worked"
        />
      </div>

      {!showsPayroll ? (
        <p className="mb-5 text-sm2 text-label2">
          Pay figures are not part of your view. Your role covers people and time, not payroll.
        </p>
      ) : null}

      {isAdmin && data?.admin ? (
        <Card className="mb-5">
          <CardHeader
            title="Access and activity"
            subtitle="The identity side of the system, which only administrators see."
          />
          <div className="grid gap-3 p-4 sm:grid-cols-4">
            {[
              { label: 'Active logins', value: num(data.admin.activeUsers), link: '/admin/users?active=true' },
              { label: 'Invites not yet used', value: num(data.admin.pendingInvites), link: '/admin/users' },
              { label: 'Grants expiring this week', value: num(data.admin.grantsExpiringIn7Days), link: '/admin/users' },
              { label: 'Refused actions today', value: num(data.admin.deniedActionsLast24h), link: '/admin/audit?outcome=DENY' },
            ].map((tile) => (
              <Link
                key={tile.label}
                to={tile.link}
                className="rounded-control bg-surface2 px-3 py-2 transition-colors hover:brightness-95 dark:hover:brightness-110"
              >
                <p className="text-xs2 text-label2">{tile.label}</p>
                <p className="tnum mt-0.5 text-[19px] font-semibold">{tile.value}</p>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        {showsPayroll ? (
          <>
            <Card>
              <CardHeader
                title="Where the money went"
                subtitle="Net pay by department for this period"
                help={
                  <HelpPopover title="How this is grouped" size="sm">
                    <p>Each payslip is attributed to the department the person belongs to now, not at the time of payment.</p>
                  </HelpPopover>
                }
              />
              <div className="h-64 p-3">
                {query.isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.salaryCostByDepartment ?? []} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--separator)" vertical={false} />
                      <XAxis
                        dataKey="departmentName"
                        interval={0}
                        tick={{ fontSize: 10, fill: 'var(--label-2)' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => moneyCompact(v)}
                        tick={{ fontSize: 11, fill: 'var(--label-2)' }}
                        axisLine={false}
                        tickLine={false}
                        width={62}
                      />
                      <ReTooltip
                        formatter={(v: number) => money(v)}
                        contentStyle={{
                          background: 'var(--surface)',
                          border: '1px solid var(--separator)',
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="amount" fill="var(--accent)" radius={[6, 6, 0, 0]} maxBarSize={44} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Six-month trend" subtitle="Total net paid, month by month" />
              <div className="h-64 p-3">
                {query.isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.monthlyNetTrend ?? []} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="trend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--separator)" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tickFormatter={(v: string) => fmtPeriod(v).slice(0, 3)}
                        tick={{ fontSize: 11, fill: 'var(--label-2)' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => moneyCompact(v)}
                        tick={{ fontSize: 11, fill: 'var(--label-2)' }}
                        axisLine={false}
                        tickLine={false}
                        width={62}
                      />
                      <ReTooltip
                        formatter={(v: number) => money(v)}
                        labelFormatter={(label: string) => fmtPeriod(label)}
                        contentStyle={{
                          background: 'var(--surface)',
                          border: '1px solid var(--separator)',
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      <Area type="monotone" dataKey="amount" stroke="var(--accent)" strokeWidth={2} fill="url(#trend)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </>
        ) : null}

        <Card className={showsPayroll ? '' : 'lg:col-span-3'}>
          <CardHeader
            title="Needs attention"
            subtitle="Each one links to the screen that fixes it."
          />
          <div className="divide-y divide-separator">
            {(data?.alerts ?? []).length === 0 ? (
              <EmptyState
                title="Nothing outstanding"
                description="No blocking issues, unanswered requests or unresolved attendance in this period."
              />
            ) : (
              data!.alerts.map((alert, index) => (
                <Link key={index} to={alert.link} className="flex items-start gap-3 px-5 py-3 hover:bg-surface2">
                  <AlertTriangle
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      alert.severity === 'BLOCKER' ? 'text-bad' : alert.severity === 'WARNING' ? 'text-warn' : 'text-label2'
                    }`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 text-sm2">{alert.message}</span>
                  <Chip tone={alert.kind === 'PAYROLL' ? 'accent' : 'neutral'}>{alert.kind.toLowerCase()}</Chip>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-label2" aria-hidden />
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Attendance this period"
            subtitle="Every recorded day, by how it classified."
            help={
              <HelpPopover title="What these mean" size="sm">
                <HelpItems
                  items={[
                    { term: 'Present and overtime', text: 'Days worked. Overtime means beyond the scheduled hours.' },
                    { term: 'Late', text: 'Still a worked day, just started after the grace period.' },
                    { term: 'Absent', text: 'A scheduled working day with no check-in at all.' },
                    { term: 'Missing check-out', text: 'Counts as no worked time until somebody resolves it.' },
                  ]}
                />
              </HelpPopover>
            }
          />
          <div className="grid grid-cols-2 gap-3 p-4">
            {[
              ['Present', data?.attendanceOverview.present, 'text-ok', '/attendance?status=PRESENT'],
              ['Late', data?.attendanceOverview.late, 'text-warn', '/attendance?status=LATE'],
              ['Absent', data?.attendanceOverview.absent, 'text-bad', '/attendance?status=ABSENT'],
              ['Overtime', data?.attendanceOverview.overtime, 'text-purple', '/attendance?status=OVERTIME'],
              ['Missing check-outs', data?.attendanceOverview.missingCheckouts, 'text-warn', '/attendance?tab=exceptions&type=MISSING_CHECKOUT'],
              ['Corrected by hand', data?.attendanceOverview.manualEdits, 'text-label2', '/attendance'],
            ].map(([label, value, tone, link]) => (
              <Link
                key={label as string}
                to={link as string}
                className="rounded-control bg-surface2 px-3 py-2 transition-colors hover:brightness-95 dark:hover:brightness-110"
              >
                <p className="text-xs2 text-label2">{label as string}</p>
                <p className={`tnum text-[19px] font-semibold ${tone as string}`}>{num(value as number)}</p>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Leave this period" subtitle="Approved days, and what is still waiting." />
          <DataTable
            rows={(data?.timeOffOverview ?? []).map((row) => ({ ...row, id: row.typeName }))}
            chrome="embedded"
            loading={query.isLoading}
            columns={[
              { key: 'typeName', header: 'Type', render: (r) => r.typeName },
              { key: 'approvedDays', header: 'Approved', align: 'right', render: (r) => num(r.approvedDays) },
              { key: 'pending', header: 'Waiting', align: 'right', render: (r) => num(r.pending) },
              {
                key: 'remaining',
                header: 'Balance left',
                align: 'right',
                tooltip: 'Only meaningful for types that require an allocation.',
                render: (r) =>
                  r.requiresAllocation ? num(r.remainingBalance ?? 0) : <span className="text-label2">—</span>,
              },
            ]}
            empty={{
              title: 'No leave types',
              description: 'Add a leave type on the Time off page before anyone can request leave.',
            }}
          />
        </Card>

        <Card>
          <CardHeader title="Departments" subtitle={showsPayroll ? 'Headcount and what each one costs.' : 'Headcount by department.'} />
          <DataTable
            rows={(data?.departments ?? []).map((row) => ({ ...row, id: row.departmentName }))}
            chrome="embedded"
            loading={query.isLoading}
            columns={[
              { key: 'departmentName', header: 'Department', render: (r) => r.departmentName },
              { key: 'headcount', header: 'People', align: 'right', render: (r) => num(r.headcount) },
              {
                key: 'salarySpend',
                header: 'Net paid',
                align: 'right',
                hidden: !showsPayroll,
                render: (r) => moneyCompact(r.salarySpend),
              },
            ]}
            empty={{
              title: 'No departments',
              description: 'Create one on the Departments page to group people for reporting.',
            }}
          />
        </Card>
      </div>
    </>
  )
}
