import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Building2, Plus, Trash2 } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import {
  Button, Card, ConfirmDialog, DataTable, EmptyState, Field, PageHeader, Sheet, TextInput, useToast,
} from '@/components/ui'
import type { Column } from '@/components/ui/DataTable'
import type { Department } from '@/api/types'

export function DepartmentsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const [editing, setEditing] = React.useState<Department | 'new' | null>(null)
  const [removing, setRemoving] = React.useState<Department | null>(null)

  const query = useQuery({ queryKey: ['departments'], queryFn: () => api.get<Department[]>('/api/departments') })
  const rows = query.data ?? []

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['departments'] })
    queryClient.invalidateQueries({ queryKey: ['employees'] })
  }
  const fail = (title: string) => (e: unknown) =>
    toast.push({ tone: 'error', title, detail: e instanceof ApiError ? e.detail : 'Unexpected error.' })

  const save = useMutation({
    mutationFn: ({ id, name }: { id: number | null; name: string }) =>
      id === null ? api.post<Department>('/api/departments', { name }) : api.put<Department>(`/api/departments/${id}`, { name }),
    onSuccess: () => { invalidate(); setEditing(null); toast.push({ tone: 'success', title: 'Department saved' }) },
    onError: fail('Could not save department'),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/api/departments/${id}`),
    onSuccess: () => { invalidate(); setRemoving(null); toast.push({ tone: 'success', title: 'Department deleted' }) },
    onError: (e) => { setRemoving(null); fail('Could not delete department')(e) },
  })

  const columns: Column<Department>[] = [
    { key: 'name', header: 'Department', render: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
    {
      key: 'count', header: 'Employees', align: 'right',
      render: (r) => <span className="tnum">{r.employeeCount}</span>, sortValue: (r) => r.employeeCount,
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/employees?departmentId=${r.id}`) }}>
            View staff
          </Button>
          {can('employee.delete.all') ? (
            <Button size="sm" aria-label={`Delete ${r.name}`} onClick={(e) => { e.stopPropagation(); setRemoving(r) }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Departments"
        description="Departments group employees for reporting and payroll cost breakdowns."
        actions={can('employee.update.all') ? (
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
            New department
          </Button>
        ) : null}
      />

      <Card>
        <DataTable
          rows={rows}
          columns={columns}
          loading={query.isLoading}
          onRowClick={(r) => can('employee.update.all') && setEditing(r)}
          empty={<EmptyState icon={<Building2 className="h-6 w-6" />} title="No departments yet"
            description="Create the first department to group employees." />}
        />
      </Card>

      {editing ? (
        <DepartmentSheet
          department={editing === 'new' ? null : editing}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSave={(name) => save.mutate({ id: editing === 'new' ? null : editing.id, name })}
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Delete ${removing?.name ?? ''}?`}
        sentence="This cannot be undone. A department that still has employees cannot be deleted."
        confirmLabel="Delete"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.id)}
      />
    </>
  )
}

function DepartmentSheet({ department, onClose, onSave, saving }: {
  department: Department | null
  onClose: () => void
  onSave: (name: string) => void
  saving: boolean
}) {
  const [name, setName] = React.useState(department?.name ?? '')
  const valid = name.trim().length > 0

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && onClose()}
      title={department ? `Department · ${department.name}` : 'New department'}
      description="Employees and payroll cost reports are grouped by department."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} disabled={!valid} onClick={() => onSave(name.trim())}>
            {department ? 'Save changes' : 'Create department'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required htmlFor="deptname">
          <TextInput id="deptname" value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && valid) onSave(name.trim()) }} placeholder="Finance" />
        </Field>
        {department ? (
          <p className="text-sm2 text-label2">
            {department.employeeCount} employee{department.employeeCount === 1 ? '' : 's'} currently assigned.
          </p>
        ) : null}
      </div>
    </Sheet>
  )
}
