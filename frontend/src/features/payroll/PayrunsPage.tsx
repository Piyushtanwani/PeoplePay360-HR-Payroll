import { useNavigate } from 'react-router-dom'
import { Plus, Wallet } from 'lucide-react'
import { usePayruns } from '@/api/hooks'
import { PAYRUN_STATE_OPTIONS } from '@/api/constants'
import { useAuth } from '@/auth/AuthProvider'
import {
  Button, Card, Chip, DataTable, HelpItems, HelpPopover, PageHeader, Select, StatusBadge, StatusLegend,
  type Column,
} from '@/components/ui'
import { fmtRange, money, num } from '@/lib/format'
import { useSearchParamState } from '@/lib/hooks/useSearchParamState'
import { useTableState } from '@/lib/hooks/useTableState'
import type { Payrun } from '@/api/types'

export function PayrunsPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const [state, setState] = useSearchParamState<string>('state', '')

  // Newest period first: the run people want is almost always the most recent.
  const table = useTableState({ defaultSort: 'periodStart', defaultDir: 'desc' })
  const list = usePayruns({ ...table.params, state: state || undefined })

  const columns: Column<Payrun>[] = [
    {
      key: 'name',
      header: 'Payrun',
      sortable: true,
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.name}</p>
          <p className="truncate text-xs2 text-label2">{r.structureName}</p>
        </div>
      ),
    },
    { key: 'periodStart', header: 'Period', sortable: true, render: (r) => fmtRange(r.periodStart, r.periodEnd) },
    { key: 'state', header: 'Status', sortable: true, render: (r) => <StatusBadge status={r.state} /> },
    { key: 'employeeCount', header: 'Employees', align: 'right', render: (r) => num(r.employeeCount) },
    { key: 'payslipCount', header: 'Payslips', align: 'right', render: (r) => num(r.payslipCount) },
    {
      key: 'issues',
      header: 'Issues',
      tooltip: 'Blockers must be fixed or overridden before validation. Warnings do not stop payment.',
      render: (r) => (
        <span className="flex items-center gap-1">
          {r.blockerCount > 0 ? <Chip tone="bad">{r.blockerCount} blocking</Chip> : null}
          {r.warningCount > 0 ? <Chip tone="warn">{r.warningCount} warning</Chip> : null}
          {r.blockerCount === 0 && r.warningCount === 0 ? <span className="text-label2">None</span> : null}
        </span>
      ),
    },
    { key: 'totalNet', header: 'Total net', align: 'right', sortable: true, render: (r) => money(r.totalNet) },
  ]

  return (
    <>
      <PageHeader
        title="Payruns"
        description="A payrun calculates one period for a set of people, checks it, and then pays it."
        help={
          <HelpPopover title="How a payrun proceeds">
            <HelpItems
              items={[
                { term: 'Draft', text: 'People are selected but nothing is calculated yet.' },
                { term: 'Computed', text: 'Payslips exist, and the checks have run. Blockers appear at this point.' },
                { term: 'Validated', text: 'Every blocker is cleared or deliberately overridden, so it may be paid.' },
                { term: 'Paid, then Sent', text: 'Paid records the payment. Sent means payslips have been emailed.' },
                { term: 'Overlaps', text: 'Someone already paid for a period is refused for a second payrun covering it.' },
              ]}
            />
          </HelpPopover>
        }
        actions={
          can('payrun.create') ? (
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/payroll/payruns/new')}>
              New payrun
            </Button>
          ) : undefined
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
          onRowClick={(r) => navigate(`/payroll/payruns/${r.id}`)}
          toolbar={{
            search: 'Search payruns by name',
            filters: (
              <>
                <Select value={state} onChange={setState} options={PAYRUN_STATE_OPTIONS} className="w-44" />
                <StatusLegend statuses={['DRAFT', 'COMPUTED', 'VALIDATED', 'PAID', 'SENT', 'CANCELLED']} />
              </>
            ),
          }}
          empty={{
            icon: <Wallet className="h-6 w-6" />,
            title: 'No payruns yet',
            description: 'A payrun covers one period for a chosen set of people, and produces their payslips.',
            action: can('payrun.create') ? (
              <Button variant="primary" onClick={() => navigate('/payroll/payruns/new')}>Start a payrun</Button>
            ) : undefined,
          }}
        />
      </Card>
    </>
  )
}
