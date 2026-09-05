import * as React from 'react'
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  useContractTemplates, useDeleteContractTemplate, useSaveContractTemplate, useScheduleNames, useStructureNames,
} from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import {
  ActiveBadge, Button, Card, ConfirmDialog, DataTable, Field, HelpItems, HelpPopover, IconButton,
  MoneyInput, Select, Sheet, TextArea, TextInput, Toggle, type Column,
} from '@/components/ui'
import { moneyExact } from '@/lib/format'
import { useTableState } from '@/lib/hooks/useTableState'
import type { ContractTemplate } from '@/api/types'

/**
 * Reusable contract terms.
 *
 * A template is never read by payroll. Choosing one while creating an employee produces a real
 * contract, so changing a template later leaves existing people exactly as they were.
 */
export function ContractTemplatesTab() {
  const { can } = useAuth()
  const table = useTableState({ prefix: 'tpl.', defaultSort: 'name', defaultDir: 'asc' })
  const templates = useContractTemplates(table.params)

  const [editing, setEditing] = React.useState<ContractTemplate | null | 'new'>(null)
  const [deleting, setDeleting] = React.useState<ContractTemplate | null>(null)
  const save = useSaveContractTemplate(() => setEditing(null))
  const remove = useDeleteContractTemplate(() => setDeleting(null))

  const columns: Column<ContractTemplate>[] = [
    { key: 'name', header: 'Template', sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'jobTitle', header: 'Job title', sortable: true, render: (r) => r.jobTitle || '—' },
    { key: 'wage', header: 'Wage', align: 'right', sortable: true, render: (r) => moneyExact(r.wage) },
    { key: 'wageType', header: 'Type', render: (r) => r.wageType.toLowerCase() },
    { key: 'schedule', header: 'Schedule', render: (r) => r.workingScheduleName ?? 'Employee’s own' },
    { key: 'structure', header: 'Salary structure', render: (r) => r.salaryStructureName ?? '—' },
    { key: 'active', header: 'Status', sortable: true, render: (r) => <ActiveBadge active={r.active} labels={['Available', 'Archived']} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '92px',
      hidden: !can('contract.update.all'),
      render: (r) => (
        <span className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <IconButton label={`Edit ${r.name}`} onClick={() => setEditing(r)}>
            <Pencil className="h-3.5 w-3.5" />
          </IconButton>
          {can('contract.delete.all') ? (
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
      <Card>
        <DataTable
          rows={templates.data?.content ?? []}
          columns={columns}
          table={table}
          total={templates.data?.totalElements}
          loading={templates.isLoading}
          fetching={templates.isFetching}
          error={templates.error}
          onRetry={() => templates.refetch()}
          onRowClick={can('contract.update.all') ? (r) => setEditing(r) : undefined}
          toolbar={{
            search: 'Search templates',
            actions: (
              <div className="flex items-center gap-2">
                <HelpPopover title="What a template is">
                  <HelpItems
                    items={[
                      { term: 'Not a contract', text: 'Payroll never reads a template. It reads the contract created from one.' },
                      { term: 'Where it is used', text: 'The employee form offers these, and creates a running contract from your choice.' },
                      { term: 'Changing one', text: 'Affects only contracts created afterwards. Existing people are untouched.' },
                      { term: 'Archiving', text: 'Keeps it for the record but hides it from the picker.' },
                    ]}
                  />
                </HelpPopover>
                {can('contract.create.all') ? (
                  <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
                    New template
                  </Button>
                ) : null}
              </div>
            ),
          }}
          empty={{
            icon: <FileText className="h-6 w-6" />,
            title: 'No contract templates yet',
            description: 'A template lets whoever onboards someone create their contract in the same step.',
            action: can('contract.create.all') ? (
              <Button variant="primary" onClick={() => setEditing('new')}>Create the first template</Button>
            ) : undefined,
          }}
        />
      </Card>

      <TemplateSheet
        open={editing !== null}
        template={editing === 'new' ? null : editing}
        saving={save.isPending}
        onOpenChange={(open) => !open && setEditing(null)}
        onSubmit={(body) => save.mutate({ id: editing === 'new' || !editing ? null : editing.id, body })}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        sentence="Contracts already created from this template keep their terms. Only the template itself is removed."
        confirmLabel="Delete template"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  )
}

function TemplateSheet({ open, template, saving, onOpenChange, onSubmit }: {
  open: boolean
  template: ContractTemplate | null
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (body: Record<string, unknown>) => void
}) {
  const schedules = useScheduleNames()
  const structures = useStructureNames(open)

  const empty = {
    name: '',
    wage: null as number | null,
    wageType: 'MONTHLY',
    workingScheduleId: null as number | null,
    salaryStructureId: null as number | null,
    jobTitle: '',
    description: '',
    active: true,
  }
  const [form, setForm] = React.useState(empty)

  React.useEffect(() => {
    if (!open) return
    setForm(
      template
        ? {
            name: template.name,
            wage: template.wage,
            wageType: template.wageType,
            workingScheduleId: template.workingScheduleId,
            salaryStructureId: template.salaryStructureId,
            jobTitle: template.jobTitle ?? '',
            description: template.description ?? '',
            active: template.active,
          }
        : empty,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template?.id])

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }))
  const valid = form.name.trim() && (form.wage ?? 0) > 0

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={template ? `Edit ${template.name}` : 'New contract template'}
      description="These terms are copied into a real contract when someone is onboarded with this template."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!valid}
            onClick={() =>
              onSubmit({
                name: form.name.trim(),
                wage: form.wage,
                wageType: form.wageType,
                workingScheduleId: form.workingScheduleId,
                salaryStructureId: form.salaryStructureId,
                jobTitle: form.jobTitle || null,
                description: form.description || null,
                active: form.active,
              })
            }
          >
            {template ? 'Save changes' : 'Create template'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Template name" required htmlFor="tpl-name" hint="What whoever onboards someone will see in the list.">
          <TextInput
            id="tpl-name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Warehouse standard"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Wage" required>
            <MoneyInput value={form.wage} onChange={(v) => set('wage', v)} />
          </Field>
          <Field label="Wage type" required>
            <Select
              value={form.wageType}
              onChange={(v) => set('wageType', v)}
              options={[
                { value: 'MONTHLY', label: 'Monthly' },
                { value: 'HOURLY', label: 'Hourly' },
              ]}
            />
          </Field>
        </div>
        <Field label="Job title">
          <TextInput value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} placeholder="Warehouse Operative" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Working schedule" hint="Leave empty to keep whatever schedule the employee already has.">
            <Select
              value={form.workingScheduleId}
              onChange={(v) => set('workingScheduleId', v)}
              options={(schedules.data ?? []).map((s) => ({
                value: s.id,
                label: s.name,
                description: `${s.weeklyHours} hours a week`,
              }))}
              placeholder="Employee’s own schedule"
              clearable
              onClear={() => set('workingScheduleId', null)}
            />
          </Field>
          <Field label="Salary structure" hint="Without one, a contract made from this template cannot be paid.">
            <Select
              value={form.salaryStructureId}
              onChange={(v) => set('salaryStructureId', v)}
              options={(structures.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
              placeholder="Select structure"
              clearable
              onClear={() => set('salaryStructureId', null)}
            />
          </Field>
        </div>
        <Field label="Notes" hint="Shown to whoever is choosing a template, to help them pick the right one.">
          <TextArea value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <div className="flex items-center justify-between rounded-card border border-separator px-4 py-3">
          <div>
            <p className="text-sm2 font-medium">Available</p>
            <p className="text-xs2 text-label2">Archived templates are kept but no longer offered when onboarding.</p>
          </div>
          <Toggle checked={form.active} onChange={(v) => set('active', v)} label="Available" />
        </div>
      </div>
    </Sheet>
  )
}
