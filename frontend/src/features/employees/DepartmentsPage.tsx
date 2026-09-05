import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useDeleteDepartment, useDepartments, useSaveDepartment } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import {
  Button, Card, ConfirmDialog, DataTable, Field, HelpItems, HelpPopover, IconButton, PageHeader,
  Sheet, TextInput, type Column,
} from '@/components/ui'
import { useTableState } from '@/lib/hooks/useTableState'
import type { Department } from '@/api/types'

export function DepartmentsPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const departments = useDepartments()

  // Departments are few, so the endpoint returns them all and the table filters, sorts and pages
  // locally. No `total` is passed, which is what puts the table in that mode.
  const table = useTableState({ url: false, defaultSort: 'name' })

  const [editing, setEditing] = React.useState<Department | null | 'new'>(null)
  const [deleting, setDeleting] = React.useState<Department | null>(null)
  const save = useSaveDepartment(() => setEditing(null))
  const remove = useDeleteDepartment(() => setDeleting(null))

  const columns: Column<Department>[] = [
    { key: 'name', header: 'Department', sortValue: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
    {
      key: 'employeeCount',
      header: 'Active employees',
      align: 'right',
      sortValue: (r) => r.employeeCount,
      render: (r) => r.employeeCount,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '140px',
      render: (r) => (
        <span className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" onClick={() => navigate(`/employees?departmentId=${r.id}`)}>View staff</Button>
          {can('employee.update.all') ? (
            <IconButton label={`Rename ${r.name}`} onClick={() => setEditing(r)}>
              <Pencil className="h-3.5 w-3.5" />
            </IconButton>
          ) : null}
          {can('employee.delete.all') ? (
            <IconButton label={`Delete ${r.name}`} onClick={() => setDeleting(r)}>
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          ) : null}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Departments"
        description="How people are grouped for reporting and for the payroll cost breakdown."
        help={
          <HelpPopover title="About departments">
            <HelpItems
              items={[
                { term: 'What they affect', text: 'Dashboard cost breakdowns, filters across the app, and reporting lines.' },
                { term: 'What they do not affect', text: 'Pay. That comes from the contract and its salary structure.' },
                { term: 'Deleting one', text: 'Only possible once nobody is in it, so no employee is left without a group.' },
              ]}
            />
          </HelpPopover>
        }
        actions={
          can('employee.update.all') ? (
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
              New department
            </Button>
          ) : undefined
        }
      />

      <Card>
        <DataTable
          rows={departments.data ?? []}
          columns={columns}
          table={table}
          searchKeys={[(r) => r.name]}
          loading={departments.isLoading}
          error={departments.error}
          onRetry={() => departments.refetch()}
          toolbar={{ search: 'Search departments' }}
          empty={{
            icon: <Building2 className="h-6 w-6" />,
            title: 'No departments yet',
            description: 'Departments group employees for reporting and for the payroll cost breakdown.',
            action: can('employee.update.all') ? (
              <Button variant="primary" onClick={() => setEditing('new')}>Add the first department</Button>
            ) : undefined,
          }}
        />
      </Card>

      <DepartmentSheet
        open={editing !== null}
        department={editing === 'new' ? null : editing}
        saving={save.isPending}
        onOpenChange={(open) => !open && setEditing(null)}
        onSubmit={(name) => save.mutate({ id: editing === 'new' || !editing ? null : editing.id, name })}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        sentence={
          deleting && deleting.employeeCount > 0
            ? `${deleting.employeeCount} people are still in this department. Move them first, or the delete will be refused.`
            : 'This department is empty, so deleting it affects nothing else.'
        }
        confirmLabel="Delete department"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  )
}

function DepartmentSheet({ open, department, saving, onOpenChange, onSubmit }: {
  open: boolean
  department: Department | null
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => void
}) {
  const [name, setName] = React.useState('')
  React.useEffect(() => { if (open) setName(department?.name ?? '') }, [open, department])

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={department ? `Rename ${department.name}` : 'New department'}
      description="Names appear on the dashboard, in filters, and on the employee record."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" loading={saving} disabled={!name.trim()} onClick={() => onSubmit(name.trim())}>
            {department ? 'Save' : 'Create department'}
          </Button>
        </>
      }
    >
      <Field label="Department name" required htmlFor="dept-name">
        <TextInput
          id="dept-name"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onSubmit(name.trim()) }}
          placeholder="Operations"
        />
      </Field>
      {department ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm2 text-label2">
          <Users className="h-3.5 w-3.5" aria-hidden />
          {department.employeeCount} active {department.employeeCount === 1 ? 'employee' : 'employees'} in this department.
        </p>
      ) : null}
    </Sheet>
  )
}
