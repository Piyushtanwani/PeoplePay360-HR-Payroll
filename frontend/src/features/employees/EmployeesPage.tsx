import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutGrid, List, Pencil, Plus, Users } from 'lucide-react'
import { useCreateEmployee, useDepartments, useEmployees, useUpdateEmployee } from '@/api/hooks'
import { EMPLOYEE_TYPE_OPTIONS } from '@/api/constants'
import { useAuth } from '@/auth/AuthProvider'
import {
  ActiveBadge, Avatar, Button, Card, Chip, DataTable, HelpItems, HelpPopover, IconButton, PageHeader,
  SegmentedControl, Select, Skeleton, type Column,
} from '@/components/ui'
import { useNumberParamState, useSearchParamState } from '@/lib/hooks/useSearchParamState'
import { useTableState } from '@/lib/hooks/useTableState'
import { api } from '@/api/client'
import { useQuery } from '@tanstack/react-query'
import { keys } from '@/api/keys'
import { EmployeeSheet } from './EmployeeSheet'
import type { Employee, EmployeeSummary } from '@/api/types'

/** Kanban groups by department, so it needs everyone the filters match rather than one page. */
const KANBAN_CAP = 200

export function EmployeesPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const departments = useDepartments()

  const [view, setView] = React.useState<'kanban' | 'list'>(
    () => (localStorage.getItem('pp360.employees.view') as 'kanban' | 'list') ?? 'list',
  )
  React.useEffect(() => localStorage.setItem('pp360.employees.view', view), [view])

  // Filters live in the address bar, which is what makes "View staff" from Departments actually work.
  const [departmentId, setDepartmentId] = useNumberParamState('departmentId')
  const [employeeType, setEmployeeType] = useSearchParamState<string>('employeeType', '')
  const [activeOnly, setActiveOnly] = useSearchParamState<string>('active', 'true')

  const table = useTableState({ defaultSort: 'displayName', defaultDir: 'asc' })
  const filters = {
    departmentId,
    employeeType: employeeType || undefined,
    active: activeOnly === 'all' ? undefined : activeOnly === 'true',
  }

  const list = useEmployees({ ...table.params, ...filters })

  // Kanban asks for everyone the filters match; the list pages properly.
  const kanban = useQuery({
    queryKey: keys.employees.list({ ...filters, page: 0, size: KANBAN_CAP, kanban: true }),
    enabled: view === 'kanban',
    queryFn: () =>
      api.page<EmployeeSummary>('/api/employees', { ...filters, size: KANBAN_CAP, sort: 'displayName,asc' }),
  })

  const [creating, setCreating] = React.useState(false)
  const [editing, setEditing] = React.useState<Employee | null>(null)
  const create = useCreateEmployee(() => setCreating(false))
  const update = useUpdateEmployee(() => setEditing(null))

  const openForEdit = async (id: number) => {
    setEditing(await api.get<Employee>(`/api/employees/${id}`))
  }

  const columns: Column<EmployeeSummary>[] = [
    {
      key: 'displayName',
      header: 'Employee',
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={r.displayName} color={r.avatarColor} size={28} />
          <div className="min-w-0">
            <p className="truncate font-medium">{r.displayName}</p>
            <p className="tnum truncate text-xs2 text-label2">{r.employeeNo}</p>
          </div>
        </div>
      ),
    },
    { key: 'jobTitle', header: 'Job title', sortable: true, render: (r) => r.jobTitle || '—' },
    { key: 'departmentId', header: 'Department', sortable: true, render: (r) => r.departmentName ?? '—' },
    {
      key: 'employeeType',
      header: 'Type',
      sortable: true,
      render: (r) => <Chip>{r.employeeType.replace('_', ' ').toLowerCase()}</Chip>,
    },
    { key: 'manager', header: 'Manager', render: (r) => r.managerName ?? '—' },
    { key: 'active', header: 'Status', sortable: true, render: (r) => <ActiveBadge active={r.active} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '56px',
      hidden: !can('employee.update.all'),
      render: (r) => (
        <span onClick={(e) => e.stopPropagation()}>
          <IconButton label={`Edit ${r.displayName}`} onClick={() => openForEdit(r.id)}>
            <Pencil className="h-3.5 w-3.5" />
          </IconButton>
        </span>
      ),
    },
  ]

  const kanbanRows = kanban.data?.content ?? []
  const grouped =
    departments.data?.map((d) => ({ department: d, people: kanbanRows.filter((r) => r.departmentId === d.id) })) ?? []
  const unassigned = kanbanRows.filter((r) => !r.departmentId)

  const filterControls = (
    <>
      <Select
        value={departmentId}
        onChange={setDepartmentId}
        clearable
        onClear={() => setDepartmentId(null)}
        placeholder="All departments"
        className="w-52"
        options={(departments.data ?? []).map((d) => ({
          value: d.id,
          label: d.name,
          description: `${d.employeeCount} employees`,
        }))}
      />
      <Select
        value={employeeType}
        onChange={setEmployeeType}
        placeholder="All types"
        className="w-44"
        options={[{ value: '', label: 'All types' }, ...EMPLOYEE_TYPE_OPTIONS]}
      />
      <Select
        value={activeOnly}
        onChange={setActiveOnly}
        className="w-40"
        options={[
          { value: 'true', label: 'Active only' },
          { value: 'false', label: 'Inactive only' },
          { value: 'all', label: 'Everyone' },
        ]}
      />
    </>
  )

  return (
    <>
      <PageHeader
        title="Employees"
        description="The people record. Pay comes from a contract, so a person is only payable once they have one."
        help={
          <HelpPopover title="How this page works">
            <HelpItems
              items={[
                { term: 'Creating someone', text: 'Records the person, and can create their contract and login in the same step.' },
                { term: 'Deactivating', text: 'Keeps every record but removes them from payruns and from these lists.' },
                { term: 'Kanban', text: 'Groups by department for browsing. It loads everyone the filters match, up to 200.' },
                { term: 'Role', text: 'Set here rather than in the Admin area, because onboarding is one action.' },
              ]}
            />
          </HelpPopover>
        }
        actions={
          <>
            <SegmentedControl
              value={view}
              onChange={setView}
              options={[
                { value: 'list', label: <span className="flex items-center gap-1.5"><List className="h-3.5 w-3.5" /> List</span> },
                { value: 'kanban', label: <span className="flex items-center gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Kanban</span> },
              ]}
            />
            {can('employee.create.all') ? (
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
                New employee
              </Button>
            ) : null}
          </>
        }
      />

      {view === 'list' ? (
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
            toolbar={{ search: 'Search name, number or email', filters: filterControls }}
            onRowClick={(r) => navigate(`/employees/${r.id}`)}
            empty={{
              icon: <Users className="h-6 w-6" />,
              title: 'No employees yet',
              description: 'People added here can be given a contract, a schedule and a login.',
              action: can('employee.create.all') ? (
                <Button variant="primary" onClick={() => setCreating(true)}>Add the first employee</Button>
              ) : undefined,
            }}
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">{filterControls}</div>
          {kanban.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
            </div>
          ) : (
            <>
              {(kanban.data?.totalElements ?? 0) > KANBAN_CAP ? (
                <p className="mb-3 text-sm2 text-label2">
                  Showing the first {KANBAN_CAP} of {kanban.data?.totalElements}. Narrow the filters, or use the list view.
                </p>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[...grouped, ...(unassigned.length ? [{ department: { id: 0, name: 'No department', employeeCount: unassigned.length }, people: unassigned }] : [])].map(
                  ({ department, people }) => (
                    <div key={department.id} className="rounded-card border border-separator bg-surface2/60 p-2">
                      <div className="flex items-center justify-between px-2 py-1.5">
                        <p className="text-sm2 font-semibold">{department.name}</p>
                        <Chip>{people.length}</Chip>
                      </div>
                      <div className="space-y-2">
                        {people.map((person) => (
                          <button
                            key={person.id}
                            onClick={() => navigate(`/employees/${person.id}`)}
                            className="w-full rounded-control border border-separator bg-surface p-3 text-left transition-shadow hover:shadow-card"
                          >
                            <div className="flex items-center gap-2.5">
                              <Avatar name={person.displayName} color={person.avatarColor} size={32} />
                              <div className="min-w-0">
                                <p className="truncate font-medium">{person.displayName}</p>
                                <p className="truncate text-xs2 text-label2">{person.jobTitle || '—'}</p>
                              </div>
                            </div>
                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                              <Chip tone="accent">{person.employeeType.replace('_', ' ').toLowerCase()}</Chip>
                              {!person.active ? <ActiveBadge active={false} /> : null}
                            </div>
                          </button>
                        ))}
                        {people.length === 0 ? (
                          <p className="px-2 py-6 text-center text-xs2 text-label2">Nobody in this department.</p>
                        ) : null}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </>
          )}
        </>
      )}

      <EmployeeSheet
        open={creating}
        onOpenChange={setCreating}
        saving={create.isPending}
        onSubmit={(body) => create.mutate(body)}
      />
      <EmployeeSheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        employee={editing}
        saving={update.isPending}
        onSubmit={(body) => editing && update.mutate({ id: editing.id, body })}
      />
    </>
  )
}
