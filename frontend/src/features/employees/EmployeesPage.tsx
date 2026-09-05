import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { LayoutGrid, List, Plus, Search, Users } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { useDepartments, useScheduleNames } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import {
  Avatar, Button, Card, Chip, DataTable, EmptyState, Field, PageHeader, SegmentedControl, Select, Sheet,
  Skeleton, StatusBadge, TextInput, useToast, DateField,
} from '@/components/ui'
import type { Column } from '@/components/ui/DataTable'
import type { Employee, EmployeeSummary, Page } from '@/api/types'

const TYPE_OPTIONS = [
  { value: 'FULL_TIME', label: 'Full time' },
  { value: 'PART_TIME', label: 'Part time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERN', label: 'Intern' },
]

export function EmployeesPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const departments = useDepartments()
  const schedules = useScheduleNames()

  const [view, setView] = React.useState<'kanban' | 'list'>(() => (localStorage.getItem('pp360.employees.view') as 'kanban' | 'list') ?? 'kanban')
  const [q, setQ] = React.useState('')
  const [departmentId, setDepartmentId] = React.useState<number | null>(null)
  const [employeeType, setEmployeeType] = React.useState<string | null>(null)
  const [creating, setCreating] = React.useState(false)

  React.useEffect(() => localStorage.setItem('pp360.employees.view', view), [view])

  const query = useQuery({
    queryKey: ['employees', q, departmentId, employeeType],
    queryFn: () => api.get<Page<Employee>>('/api/employees', { q, departmentId, employeeType, size: 200 }),
  })

  const rows = query.data?.content ?? []

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Employee>('/api/employees', body),
    onSuccess: (employee) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setCreating(false)
      toast.push({ tone: 'success', title: 'Employee created', detail: `${employee.displayName} · ${employee.employeeNo}` })
    },
    onError: (error) => toast.push({ tone: 'error', title: 'Could not create employee', detail: error instanceof ApiError ? error.detail : '', requestId: error instanceof ApiError ? error.requestId : undefined }),
  })

  const columns: Column<Employee>[] = [
    {
      key: 'employee', header: 'Employee', sortValue: (r) => r.displayName,
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
    { key: 'email', header: 'Work email', render: (r) => <span className="text-label2">{r.workEmail}</span>, sortValue: (r) => r.workEmail },
    { key: 'title', header: 'Job position', render: (r) => r.jobTitle, sortValue: (r) => r.jobTitle },
    { key: 'department', header: 'Department', render: (r) => r.departmentName, sortValue: (r) => r.departmentName },
    { key: 'type', header: 'Type', render: (r) => <Chip>{r.employeeType.replace('_', ' ').toLowerCase()}</Chip> },
    { key: 'manager', header: 'Manager', render: (r) => r.managerName ?? '—' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.active ? 'ACTIVE' : 'CANCELLED'} /> },
  ]

  const grouped = departments.data?.map((d) => ({ department: d, people: rows.filter((r) => r.departmentId === d.id) })) ?? []

  return (
    <>
      <PageHeader
        title="Employees"
        description="Kanban is for browsing; the list is the fastest way to open one record."
        actions={
          <>
            <SegmentedControl
              value={view}
              onChange={setView}
              options={[
                { value: 'kanban', label: <span className="flex items-center gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Kanban</span> },
                { value: 'list', label: <span className="flex items-center gap-1.5"><List className="h-3.5 w-3.5" /> List</span> },
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

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-label2" />
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employees…" className="pl-8" />
        </div>
        <Select value={departmentId} onChange={setDepartmentId} clearable onClear={() => setDepartmentId(null)} placeholder="All departments"
          options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name, description: `${d.employeeCount} employees` }))} />
        <Select value={employeeType} onChange={setEmployeeType} clearable onClear={() => setEmployeeType(null)} placeholder="All types" options={TYPE_OPTIONS} />
        <p className="self-center text-sm2 text-label2">{query.isLoading ? 'Loading…' : `${rows.length} employees`}</p>
      </div>

      {view === 'list' ? (
        <Card>
          <DataTable rows={rows} columns={columns} loading={query.isLoading} onRowClick={(r) => navigate(`/employees/${r.id}`)}
            empty={<EmptyState icon={<Users className="h-6 w-6" />} title="No employees match" description="Clear the filters or create the first record." />} />
        </Card>
      ) : query.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {grouped.map(({ department, people }) => (
            <div key={department.id} className="rounded-card border border-separator bg-surface2/60 p-2">
              <div className="flex items-center justify-between px-2 py-1.5">
                <p className="text-sm2 font-semibold">{department.name}</p>
                <Chip>{people.length}</Chip>
              </div>
              <div className="space-y-2">
                {people.map((person) => (
                  <button key={person.id} onClick={() => navigate(`/employees/${person.id}`)}
                    className="w-full rounded-control border border-separator bg-surface p-3 text-left transition-shadow hover:shadow-card">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={person.displayName} color={person.avatarColor} size={32} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{person.displayName}</p>
                        <p className="truncate text-xs2 text-label2">{person.jobTitle}</p>
                      </div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <Chip tone="accent">{person.employeeType.replace('_', ' ').toLowerCase()}</Chip>
                      <Chip>{person.counts.contracts} contract{person.counts.contracts === 1 ? '' : 's'}</Chip>
                      <Chip>{person.counts.timeOffRequests} time off</Chip>
                    </div>
                  </button>
                ))}
                {people.length === 0 ? <p className="px-2 py-6 text-center text-xs2 text-label2">No one here yet.</p> : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <NewEmployeeSheet
        open={creating}
        onOpenChange={setCreating}
        saving={create.isPending}
        departments={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
        managers={rows.map((r) => ({ value: r.id, label: r.displayName, description: r.jobTitle }))}
        schedules={(schedules.data ?? []).map((s) => ({ value: s.id, label: s.name, description: `${s.weeklyHours}h per week` }))}
        onSubmit={(body) => create.mutate(body)}
      />
    </>
  )
}

function NewEmployeeSheet({ open, onOpenChange, departments, managers, schedules, onSubmit, saving }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  departments: { value: number; label: string }[]
  managers: { value: number; label: string; description?: string }[]
  schedules: { value: number; label: string; description?: string }[]
  onSubmit: (body: Record<string, unknown>) => void
  saving: boolean
}) {
  const [form, setForm] = React.useState({
    displayName: '', workEmail: '', jobTitle: '', departmentId: null as number | null,
    managerId: null as number | null, employeeType: 'FULL_TIME', workingScheduleId: null as number | null,
    hireDate: '2026-09-01',
  })
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))
  const valid = form.displayName.trim() && form.workEmail.includes('@') && form.departmentId

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="New employee"
      description="Creating an employee does not create a login. Users are created separately by an administrator."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" loading={saving} disabled={!valid} onClick={() => onSubmit(form)}>Create employee</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Full name" required htmlFor="name">
          <TextInput id="name" value={form.displayName} onChange={(e) => set('displayName', e.target.value)} placeholder="Avery Nolan" />
        </Field>
        <Field label="Work email" required htmlFor="email">
          <TextInput id="email" type="email" value={form.workEmail} onChange={(e) => set('workEmail', e.target.value)} placeholder="employee@company.com" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Department" required><Select value={form.departmentId} onChange={(v) => set('departmentId', v)} options={departments} placeholder="Select department" /></Field>
          <Field label="Employee type" required><Select value={form.employeeType} onChange={(v) => set('employeeType', v)} options={TYPE_OPTIONS} /></Field>
        </div>
        <Field label="Job position"><TextInput value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} placeholder="Payroll Specialist" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Manager"><Select value={form.managerId} onChange={(v) => set('managerId', v)} options={managers} placeholder="Select manager" clearable onClear={() => set('managerId', null)} /></Field>
          <Field label="Working schedule"><Select value={form.workingScheduleId} onChange={(v) => set('workingScheduleId', v)} options={schedules} placeholder="Select schedule" /></Field>
        </div>
        <Field label="Hire date"><DateField value={form.hireDate} onChange={(v) => set('hireDate', v)} /></Field>
      </div>
    </Sheet>
  )
}
