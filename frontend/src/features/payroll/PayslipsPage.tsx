import * as React from 'react'
import { FileText } from 'lucide-react'
import { useEmployeeOptions, usePayslips } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import {
  Card, DataTable, HelpItems, HelpPopover, MonthPicker, PageHeader, Select, StatusBadge, type Column,
} from '@/components/ui'
import { fmtRange, money } from '@/lib/format'
import { useNumberParamState, useSearchParamState } from '@/lib/hooks/useSearchParamState'
import { useTableState } from '@/lib/hooks/useTableState'
import { PayslipSheet } from './PayslipSheet'
import type { Payslip } from '@/api/types'

export function PayslipsPage() {
  const { can } = useAuth()
  const seesEveryone = can('payslip.read.all')
  const employees = useEmployeeOptions(seesEveryone)

  const [period, setPeriod] = useSearchParamState<string>('period', '')
  const [employeeId, setEmployeeId] = useNumberParamState('employeeId')
  const [payslipId, setPayslipId] = useNumberParamState('payslipId')

  // Newest period first, then by person, so a month reads as one alphabetical block.
  const table = useTableState({ defaultSort: 'periodStart', defaultDir: 'desc' })
  const list = usePayslips({ ...table.params, period: period || undefined, employeeId })

  const columns: Column<Payslip>[] = [
    {
      key: 'employeeId',
      header: 'Employee',
      sortable: true,
      hidden: !seesEveryone,
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.employeeName}</p>
          <p className="tnum truncate text-xs2 text-label2">{r.employeeNo}</p>
        </div>
      ),
    },
    { key: 'periodStart', header: 'Period', sortable: true, render: (r) => fmtRange(r.periodStart, r.periodEnd) },
    { key: 'payrun', header: 'Payrun', render: (r) => r.payrunName },
    { key: 'gross', header: 'Gross', align: 'right', sortable: true, render: (r) => money(r.gross) },
    { key: 'deductions', header: 'Deductions', align: 'right', sortable: true, render: (r) => money(r.deductions) },
    { key: 'net', header: 'Net', align: 'right', sortable: true, render: (r) => <span className="font-semibold">{money(r.net)}</span> },
    {
      key: 'delivery',
      header: 'Payslip sent',
      tooltip: 'Whether the payslip has been emailed to the person.',
      render: (r) => <StatusBadge status={r.delivery?.status ?? 'NOT_SENT'} />,
    },
  ]

  return (
    <>
      <PageHeader
        title="Payslips"
        description={
          seesEveryone
            ? 'Every payslip produced by a payrun. Open one to see how the figure was reached.'
            : 'Your payslips. Open one to see exactly how the amount was calculated.'
        }
        help={
          <HelpPopover title="Reading a payslip">
            <HelpItems
              items={[
                { term: 'How it is built', text: 'The salary structure’s rules run in order; each produces one line.' },
                { term: 'Net', text: 'Always gross less deductions, which the system checks before saving.' },
                { term: 'Inputs', text: 'Days worked, scheduled and unpaid, plus overtime hours, all from attendance and leave.' },
                { term: 'Immutable', text: 'A payslip cannot be edited once produced. Correct the data and recompute the payrun.' },
              ]}
            />
          </HelpPopover>
        }
      />

      <Card>
        <DataTable
          rows={list.data?.content ?? []}
          columns={columns}
          table={table}
          total={list.data?.totalElements}
          loading={list.isLoading}
          fetching={list.isFetching}
          error={list.error}
          onRetry={() => list.refetch()}
          onRowClick={(r) => setPayslipId(r.id)}
          toolbar={{
            search: seesEveryone ? 'Search by name or number' : false,
            filters: (
              <>
                <MonthPicker value={period} onChange={setPeriod} clearable placeholder="All periods" className="w-48" />
                {seesEveryone ? (
                  <Select
                    value={employeeId}
                    onChange={setEmployeeId}
                    clearable
                    onClear={() => setEmployeeId(null)}
                    placeholder="All employees"
                    className="w-56"
                    options={(employees.data?.content ?? []).map((e) => ({
                      value: e.id,
                      label: e.displayName,
                      description: e.employeeNo,
                    }))}
                  />
                ) : null}
              </>
            ),
          }}
          empty={{
            icon: <FileText className="h-6 w-6" />,
            title: 'No payslips',
            description: seesEveryone
              ? 'Payslips appear once a payrun has been computed.'
              : 'Your payslips appear here once payroll has run for the period.',
          }}
        />
      </Card>

      <PayslipSheet payslipId={payslipId} onOpenChange={(open) => !open && setPayslipId(null)} />
    </>
  )
}
