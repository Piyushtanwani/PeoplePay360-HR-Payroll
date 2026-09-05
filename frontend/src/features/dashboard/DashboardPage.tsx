import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis,
} from 'recharts'
import { AlertTriangle, ArrowUpRight } from 'lucide-react'
import { api } from '@/api/client'
import { useDepartments } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import { Card, CardHeader, Chip, EmptyState, KpiCard, MonthPicker, PageHeader, Select, Skeleton } from '@/components/ui'
import { fmtPeriod, monthKey, money, num, pct } from '@/lib/format'

/**
 * The last calendar month, not the current one: payroll for the in-progress month hasn't
 * been run yet, so defaulting to "now" would open on an empty dashboard every time.
 */
function lastClosedPeriod() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return monthKey(d)
}
import type { Dashboard } from '@/api/types'

const EMPLOYEE_TYPES = [
  { value: 'FULL_TIME', label: 'Full time' },
  { value: 'PART_TIME', label: 'Part time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERN', label: 'Intern' },
]

export function DashboardPage() {
  const { can } = useAuth()
  const [period, setPeriod] = React.useState(lastClosedPeriod)
  const [departmentId, setDepartmentId] = React.useState<number | null>(null)
  const [employeeType, setEmployeeType] = React.useState<string | null>(null)
  const departments = useDepartments()

  const query = useQuery({
    queryKey: ['dashboard', period, departmentId, employeeType],
    refetchInterval: 15_000,
    queryFn: () => api.get<Dashboard>('/api/reports/dashboard', { period, departmentId, employeeType }),
  })

  const data = query.data
  const showsPayroll = can('dashboard.read.payroll')

  return (
    <>
      <PageHeader
        title="Payroll dashboard"
        description={`Payments, staffing impact, leave patterns and attendance quality for ${fmtPeriod(period)}.`}
        actions={
          <span className="flex items-center gap-1.5 text-xs2 text-label2">
            <span className={`h-1.5 w-1.5 rounded-full ${query.isFetching ? 'bg-warn' : 'bg-ok'}`} />
            {query.isFetching ? 'Refreshing…' : 'Live · 15s'}
          </span>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MonthPicker value={period} onChange={setPeriod} />
        <Select
          value={departmentId}
          onChange={setDepartmentId}
          clearable
          onClear={() => setDepartmentId(null)}
          placeholder="All departments"
          options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name, description: `${d.employeeCount} employees` }))}
        />
        <Select
          value={employeeType}
          onChange={setEmployeeType}
          clearable
          onClear={() => setEmployeeType(null)}
          placeholder="All employee types"
          options={EMPLOYEE_TYPES}
        />
      </div>

      <div className={`mb-5 grid gap-3 ${showsPayroll ? 'sm:grid-cols-2 xl:grid-cols-5' : 'sm:grid-cols-2'}`}>
        {showsPayroll ? (
          <>
            <KpiCard label="Total net salary paid" value={money(data?.kpis.totalNetPaid, { compact: true })} caption="Across the selected period" loading={query.isLoading} />
            <KpiCard label="Payslips generated" value={num(data?.kpis.payslipsGenerated)} caption={`${num(data?.kpis.payslipsPaid)} paid · ${num(data?.kpis.payslipsPending)} pending`} loading={query.isLoading} />
            <KpiCard label="Average salary / employee" value={money(data?.kpis.averageSalary, { compact: true })} caption="Based on the current payrun" loading={query.isLoading} />
          </>
        ) : null}
        <KpiCard label="Approved time off" value={`${num(data?.kpis.approvedTimeOffDays)} days`} caption="Approved inside the period" loading={query.isLoading} />
        <KpiCard
          label="Attendance health"
          value={pct(data?.kpis.attendanceHealthPct)}
          caption="Present or reviewed records"
          tone={(data?.kpis.attendanceHealthPct ?? 100) >= 90 ? 'ok' : 'warn'}
          loading={query.isLoading}
        />
      </div>

      {!showsPayroll ? (
        <p className="mb-5 text-sm2 text-label2">Payroll figures are not included in your view.</p>
      ) : null}

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        {showsPayroll ? (
          <>
            <Card className="lg:col-span-1">
              <CardHeader title="Salary cost by department" subtitle="Source: Payslips + Employee department" />
              <div className="h-64 p-3">
                {query.isLoading ? <Skeleton className="h-full w-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.salaryCostByDepartment ?? []} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--separator)" vertical={false} />
                      <XAxis dataKey="departmentName" interval={0} tick={{ fontSize: 10, fill: 'var(--label-2)' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => money(v, { compact: true })} tick={{ fontSize: 11, fill: 'var(--label-2)' }} axisLine={false} tickLine={false} width={62} />
                      <ReTooltip
                        formatter={(v: number) => money(v)}
                        contentStyle={{ background: 'var(--surface)', border: '1px solid var(--separator)', borderRadius: 12, fontSize: 12 }}
                      />
                      <Bar dataKey="amount" fill="var(--accent)" radius={[6, 6, 0, 0]} maxBarSize={44} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card className="lg:col-span-1">
              <CardHeader title="Monthly net salary trend" subtitle="Source: historical payslips and payruns" />
              <div className="h-64 p-3">
                {query.isLoading ? <Skeleton className="h-full w-full" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.monthlyNetTrend ?? []} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="trend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--separator)" vertical={false} />
                      <XAxis dataKey="month" tickFormatter={(v: string) => v.slice(5)} tick={{ fontSize: 11, fill: 'var(--label-2)' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => money(v, { compact: true })} tick={{ fontSize: 11, fill: 'var(--label-2)' }} axisLine={false} tickLine={false} width={62} />
                      <ReTooltip
                        formatter={(v: number) => money(v)}
                        contentStyle={{ background: 'var(--surface)', border: '1px solid var(--separator)', borderRadius: 12, fontSize: 12 }}
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
          <CardHeader title="Payroll alerts" subtitle="Source: payrun and payslip validation" />
          <div className="divide-y divide-separator">
            {(data?.alerts ?? []).length === 0 ? (
              <EmptyState title="No alerts" description="Nothing needs attention in this period." />
            ) : (
              data!.alerts.map((alert, index) => (
                <Link key={index} to={alert.link} className="flex items-start gap-3 px-5 py-3 hover:bg-surface2">
                  <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${alert.severity === 'BLOCKER' ? 'text-bad' : alert.severity === 'WARNING' ? 'text-warn' : 'text-label2'}`} />
                  <span className="min-w-0 flex-1 text-sm2">{alert.message}</span>
                  <Chip tone={alert.kind === 'PAYROLL' ? 'accent' : 'neutral'}>{alert.kind}</Chip>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-label2" />
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Attendance overview" subtitle="Source: attendance" />
          <div className="grid grid-cols-2 gap-3 p-4">
            {[
              ['Present', data?.attendanceOverview.present, 'text-ok'],
              ['Late', data?.attendanceOverview.late, 'text-warn'],
              ['Absent', data?.attendanceOverview.absent, 'text-bad'],
              ['Overtime', data?.attendanceOverview.overtime, 'text-purple'],
              ['Missing check-outs', data?.attendanceOverview.missingCheckouts, 'text-warn'],
              ['Manual edits', data?.attendanceOverview.manualEdits, 'text-label2'],
            ].map(([label, value, tone]) => (
              <div key={label as string} className="rounded-control bg-surface2 px-3 py-2">
                <p className="text-xs2 text-label2">{label as string}</p>
                <p className={`tnum text-[19px] font-semibold ${tone as string}`}>{num(value as number)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Time off overview" subtitle="Source: time off requests and allocations" />
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-separator text-left text-xs2 uppercase tracking-wide text-label2">
                <th className="px-5 py-2">Type</th>
                <th className="px-5 py-2 text-right">Approved days</th>
                <th className="px-5 py-2 text-right">Pending</th>
                <th className="px-5 py-2 text-right">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {(data?.timeOffOverview ?? []).map((row) => (
                <tr key={row.typeName} className="border-b border-separator/60 last:border-0">
                  <td className="px-5 py-2">{row.typeName}</td>
                  <td className="tnum px-5 py-2 text-right">{num(row.approvedDays)}</td>
                  <td className="tnum px-5 py-2 text-right">{num(row.pending)}</td>
                  <td className="tnum px-5 py-2 text-right">
                    {row.requiresAllocation ? num(row.remainingBalance ?? 0) : <span className="text-label2">N/A</span>}
                  </td>
                </tr>
              ))}
              {(data?.timeOffOverview ?? []).length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-6 text-center text-sm2 text-label2">No leave types configured.</td></tr>
              ) : null}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardHeader title="Department overview" subtitle="Source: employee, contract and payslip totals" />
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-separator text-left text-xs2 uppercase tracking-wide text-label2">
                <th className="px-5 py-2">Department</th>
                <th className="px-5 py-2 text-right">Headcount</th>
                {showsPayroll ? <th className="px-5 py-2 text-right">Monthly salary</th> : null}
              </tr>
            </thead>
            <tbody>
              {(data?.departments ?? []).map((row) => (
                <tr key={row.departmentName} className="border-b border-separator/60 last:border-0">
                  <td className="px-5 py-2">{row.departmentName}</td>
                  <td className="tnum px-5 py-2 text-right">{row.headcount}</td>
                  {showsPayroll ? <td className="tnum px-5 py-2 text-right">{money(row.salarySpend, { compact: true })}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardHeader title="Models aggregated here" subtitle="The dashboard reads live HR and payroll data" />
          <ul className="space-y-2 p-5 text-sm2 text-label2">
            <li>• Employees and departments → headcount, grouping</li>
            <li>• Contracts → wage, schedule, active employees</li>
            <li>• Payruns and payslips → salary totals, paid vs pending, trend</li>
            <li>• Attendance → presence, absence, late entries, overtime</li>
            <li>• Time off requests and allocations → leave taken and balances</li>
          </ul>
        </Card>
      </div>
    </>
  )
}
