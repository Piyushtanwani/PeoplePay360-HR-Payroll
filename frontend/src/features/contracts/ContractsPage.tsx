import * as React from 'react'
import { Link } from 'react-router-dom'
import { FileSignature, Plus } from 'lucide-react'
import {
  useContractAction, useContracts, useDeleteContract, useEmployeeOptions, useSaveContract,
} from '@/api/hooks'
import { CONTRACT_STATE_OPTIONS } from '@/api/constants'
import { useAuth } from '@/auth/AuthProvider'
import {
  Button, Card, ConfirmDialog, DataTable, HelpItems, HelpPopover, PageHeader, Select, StatusBadge,
  StatusLegend, TabPanel, Tabs, type Column,
} from '@/components/ui'
import { fmtDate, money } from '@/lib/format'
import { useNumberParamState, useSearchParamState } from '@/lib/hooks/useSearchParamState'
import { useTableState } from '@/lib/hooks/useTableState'
import { ContractSheet } from './ContractSheet'
import { ContractTemplatesTab } from './ContractTemplatesTab'
import type { Contract } from '@/api/types'

export function ContractsPage() {
  const { can } = useAuth()
  const [tab] = useSearchParamState<string>('tab', 'contracts')

  return (
    <>
      <PageHeader
        title="Contracts"
        description="What payroll reads for each person. Everything about pay lives here, not on the employee record."
        help={
          <HelpPopover title="How contracts work">
            <HelpItems
              items={[
                { term: 'One at a time', text: 'Contracts for a person may not overlap, so any period resolves to exactly one.' },
                { term: 'What payroll uses', text: 'The wage, wage type and salary structure on the contract covering the period.' },
                { term: 'Draft and running', text: 'A draft affects nothing. Activating it makes it the contract payroll reads.' },
                { term: 'Ending one', text: 'Set an end date, or cancel it. History is kept either way.' },
                { term: 'Templates', text: 'Reusable terms so onboarding creates the contract in the same step.' },
              ]}
            />
          </HelpPopover>
        }
      />

      <Tabs
        urlKey="tab"
        items={[
          { value: 'contracts', label: 'Contracts' },
          { value: 'templates', label: 'Templates', hidden: !can('contract.read.all') },
        ]}
      >
        <TabPanel value="contracts">
          <ContractsTab />
        </TabPanel>
        <TabPanel value="templates">{tab === 'templates' ? <ContractTemplatesTab /> : null}</TabPanel>
      </Tabs>
    </>
  )
}

function ContractsTab() {
  const { can } = useAuth()
  const employees = useEmployeeOptions(can('employee.read.all'))

  const [state, setState] = useSearchParamState<string>('state', '')
  const [employeeId, setEmployeeId] = useNumberParamState('employeeId')
  const [contractId, setContractId] = useNumberParamState('contractId')

  const table = useTableState({ defaultSort: 'startDate', defaultDir: 'desc' })
  const list = useContracts({ ...table.params, state: state || undefined, employeeId })

  const [creating, setCreating] = React.useState(false)
  const [open, setOpen] = React.useState<Contract | null>(null)
  const [cancelling, setCancelling] = React.useState<Contract | null>(null)
  const [deleting, setDeleting] = React.useState<Contract | null>(null)

  // A contract can be deep-linked from the employee record or the audit log.
  React.useEffect(() => {
    if (contractId === null) return
    const match = list.data?.content.find((c) => c.id === contractId)
    if (match) setOpen(match)
  }, [contractId, list.data])

  const save = useSaveContract(() => { setCreating(false); setOpen(null) })
  const action = useContractAction(() => { setCancelling(null); setOpen(null) })
  const remove = useDeleteContract(() => { setDeleting(null); setOpen(null) })

  const columns: Column<Contract>[] = [
    { key: 'reference', header: 'Reference', sortable: true, render: (r) => <span className="tnum font-medium">{r.reference}</span> },
    {
      key: 'employeeId',
      header: 'Employee',
      sortable: true,
      render: (r) => (
        <Link
          to={`/employees/${r.employeeId}`}
          onClick={(e) => e.stopPropagation()}
          className="font-medium text-accent hover:underline"
        >
          {r.employeeName}
        </Link>
      ),
    },
    { key: 'jobTitle', header: 'Job title', sortable: true, render: (r) => r.jobTitle || '—' },
    { key: 'startDate', header: 'Start', sortable: true, render: (r) => fmtDate(r.startDate) },
    { key: 'endDate', header: 'End', sortable: true, render: (r) => (r.endDate ? fmtDate(r.endDate) : 'Open ended') },
    {
      key: 'wage',
      header: 'Wage',
      align: 'right',
      sortable: true,
      tooltip: 'Hidden unless your role may read all contracts.',
      render: (r) => (r.wage !== null ? money(r.wage) : '—'),
    },
    { key: 'structure', header: 'Salary structure', render: (r) => r.salaryStructureName ?? '—' },
    { key: 'state', header: 'Status', sortable: true, render: (r) => <StatusBadge status={r.state} /> },
  ]

  return (
    <>
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
          onRowClick={(r) => { setOpen(r); setContractId(r.id) }}
          toolbar={{
            search: 'Search reference, person or job title',
            filters: (
              <>
                <Select value={state} onChange={setState} options={CONTRACT_STATE_OPTIONS} className="w-44" />
                {can('employee.read.all') ? (
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
                <StatusLegend statuses={['DRAFT', 'RUNNING', 'EXPIRED', 'CANCELLED']} />
              </>
            ),
            actions: can('contract.create.all') ? (
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
                New contract
              </Button>
            ) : undefined,
          }}
          empty={{
            icon: <FileSignature className="h-6 w-6" />,
            title: 'No contracts here',
            description: 'A person needs a running contract covering the period before payroll can pay them.',
            action: can('contract.create.all') ? (
              <Button variant="primary" onClick={() => setCreating(true)}>Create a contract</Button>
            ) : undefined,
          }}
        />
      </Card>

      <ContractSheet
        open={creating}
        onOpenChange={setCreating}
        employeeId={employeeId}
        saving={save.isPending}
        error={save.error}
        onSubmit={(body) => save.mutate({ id: null, body })}
      />

      <ContractSheet
        open={open !== null}
        onOpenChange={(isOpen) => { if (!isOpen) { setOpen(null); setContractId(null) } }}
        contract={open}
        saving={save.isPending}
        error={save.error}
        onSubmit={(body) => open && save.mutate({ id: open.id, body })}
        footerActions={
          open ? (
            <>
              {open.state === 'DRAFT' && can('contract.activate') ? (
                <Button variant="primary" loading={action.isPending} onClick={() => action.mutate({ id: open.id, action: 'activate' })}>
                  Activate
                </Button>
              ) : null}
              {['DRAFT', 'RUNNING'].includes(open.state) && can('contract.update.all') ? (
                <Button variant="danger" onClick={() => setCancelling(open)}>Cancel contract</Button>
              ) : null}
              {open.state === 'DRAFT' && can('contract.delete.all') ? (
                <Button onClick={() => setDeleting(open)}>Delete draft</Button>
              ) : null}
            </>
          ) : null
        }
      />

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(isOpen) => !isOpen && setCancelling(null)}
        title={`Cancel ${cancelling?.reference}?`}
        sentence={`${cancelling?.employeeName} will have no contract for the period this one covered, so they cannot be paid until another is in force.`}
        confirmLabel="Cancel contract"
        tone="danger"
        loading={action.isPending}
        onConfirm={() => cancelling && action.mutate({ id: cancelling.id, action: 'cancel' })}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(isOpen) => !isOpen && setDeleting(null)}
        title={`Delete ${deleting?.reference}?`}
        sentence="A draft contract affects nothing, so deleting it removes it entirely rather than keeping a record."
        confirmLabel="Delete draft"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  )
}
