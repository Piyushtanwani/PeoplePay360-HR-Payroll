import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { api } from '@/api/client'
import { useEmployeeOptions } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import { Card, Chip, DataTable, MonthPicker, PageHeader, Select, StatusBadge } from '@/components/ui'
import { fmtDate, money } from '@/lib/format'
import type { Page, Payslip } from '@/api/types'
import { PayslipSheet } from './PayslipSheet'

export function PayslipsPage() {
  const { can } = useAuth()
  const seesAll = can('payslip.read.all')
  const employees = useEmployeeOptions(seesAll)
  const [searchParams] = useSearchParams()
  const [period, setPeriod] = React.useState<string | null>(null)
  const [employeeId, setEmployeeId] = React.useState<number | null>(null)
  const [open, setOpen] = React.useState<number | null>(searchParams.get('payslipId') ? Number(searchParams.get('payslipId')) : null)

  const query = useQuery({
    queryKey: ['payslips', period, employeeId],
    queryFn: () => api.page<Payslip>('/api/payslips', { period, employeeId, size: 200 }),
  })

  return (
    <>
      <PageHeader title="Payslips" description="Selecting a payslip opens the detailed salary computation and the PDF action." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-52"><MonthPicker value={period ?? ''} onChange={setPeriod} /></div>
        {seesAll ? (
          <Select className="w-64" value={employeeId} onChange={setEmployeeId} clearable onClear={() => setEmployeeId(null)} placeholder="All employees"
            options={(employees.data?.content ?? []).map((e) => ({ value: e.id, label: e.displayName, description: e.employeeNo }))} />
        ) : null}
        <span className="text-sm2 text-label2">{query.data?.totalElements ?? 0} payslips</span>
      </div>

      <Card>
        <DataTable
          rows={query.data?.content ?? []}
          loading={query.isLoading}
          onRowClick={(row) => setOpen(row.id)}
          columns={[
            ...(seesAll ? [{ key: 'employee', header: 'Employee', render: (r: Payslip) => r.employeeName, sortValue: (r: Payslip) => r.employeeName }] : []),
            { key: 'period', header: 'Period', render: (r) => `${fmtDate(r.periodStart)} — ${fmtDate(r.periodEnd)}`, sortValue: (r) => r.periodStart },
            { key: 'payrun', header: 'Payrun', render: (r) => r.payrunName },
            { key: 'basic', header: 'Basic', align: 'right', render: (r) => money(r.basic, { compact: true }) },
            { key: 'gross', header: 'Gross', align: 'right', render: (r) => money(r.gross, { compact: true }) },
            { key: 'net', header: 'Net', align: 'right', render: (r) => <span className="font-semibold">{money(r.net, { compact: true })}</span>, sortValue: (r) => r.net },
            { key: 'state', header: 'Payrun state', render: (r) => <StatusBadge status={r.payrunState} /> },
            { key: 'delivery', header: 'Delivery', render: (r) => <Chip tone={r.delivery.status === 'SENT' ? 'ok' : r.delivery.status === 'FAILED' ? 'bad' : 'neutral'}>{r.delivery.status.replace(/_/g, ' ').toLowerCase()}</Chip> },
          ]}
        />
      </Card>

      {open ? <PayslipSheet payslipId={open} onClose={() => setOpen(null)} /> : null}
    </>
  )
}
