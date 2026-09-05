import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import { Button, Card, Chip, DataTable, EmptyState, PageHeader, SegmentedControl, StatusBadge } from '@/components/ui'
import { fmtDate, money, num } from '@/lib/format'
import type { Page, Payrun } from '@/api/types'

export function PayrunsPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const [state, setState] = React.useState<string | null>(null)

  const query = useQuery({ queryKey: ['payruns', state], queryFn: () => api.get<Page<Payrun>>('/api/payruns', { state, size: 100 }) })

  return (
    <>
      <PageHeader
        title="Payruns"
        description="Each payrun represents one payroll period and groups the payslips generated for it."
        actions={can('payrun.create') ? <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/payroll/payruns/new')}>New payrun</Button> : undefined}
      />

      <div className="mb-4">
        <SegmentedControl
          value={state ?? 'ALL'}
          onChange={(value) => setState(value === 'ALL' ? null : value)}
          options={[
            { value: 'ALL', label: 'All' }, { value: 'DRAFT', label: 'Draft' }, { value: 'COMPUTED', label: 'Computed' },
            { value: 'VALIDATED', label: 'Validated' }, { value: 'PAID', label: 'Paid' }, { value: 'SENT', label: 'Sent' },
          ]}
        />
      </div>

      <Card>
        <DataTable
          rows={query.data?.content ?? []}
          loading={query.isLoading}
          onRowClick={(row) => navigate(`/payroll/payruns/${row.id}`)}
          empty={<EmptyState title="No payruns yet" description="Create the first payrun to generate payslips for a period." />}
          columns={[
            { key: 'name', header: 'Payrun', render: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.periodStart },
            { key: 'period', header: 'Period', render: (r) => `${fmtDate(r.periodStart)} — ${fmtDate(r.periodEnd)}` },
            { key: 'structure', header: 'Structure', render: (r) => r.structureName },
            { key: 'employees', header: 'Employees', align: 'right', render: (r) => num(r.employeeCount) },
            { key: 'payslips', header: 'Payslips', align: 'right', render: (r) => num(r.payslipCount) },
            { key: 'net', header: 'Total net', align: 'right', render: (r) => money(r.totalNet, { compact: true }), sortValue: (r) => r.totalNet },
            {
              key: 'issues', header: 'Issues',
              render: (r) => (
                <span className="flex gap-1.5">
                  {r.blockerCount ? <Chip tone="bad">{r.blockerCount} blocker{r.blockerCount === 1 ? '' : 's'}</Chip> : null}
                  {r.warningCount ? <Chip tone="warn">{r.warningCount} warning{r.warningCount === 1 ? '' : 's'}</Chip> : null}
                  {!r.blockerCount && !r.warningCount ? <span className="text-label2">No warnings</span> : null}
                </span>
              ),
            },
            { key: 'state', header: 'Status', render: (r) => <StatusBadge status={r.state} /> },
          ]}
        />
      </Card>
    </>
  )
}
