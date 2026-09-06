import * as React from 'react'
import { ArrowDown, ArrowUp, Calculator, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  useDeleteRule, useDeleteStructure, useReorderRules, useSaveStructure, useSetRuleActive, useStructure,
  useStructures,
} from '@/api/hooks'
import { CATEGORY_TONES, RULE_CATEGORY_OPTIONS } from '@/api/constants'
import { useAuth } from '@/auth/AuthProvider'
import {
  ActiveBadge, Button, Card, CardHeader, Chip, ConfirmDialog, DataTable, Field, HelpItems, HelpPopover,
  IconButton, PageHeader, Sheet, TextInput, Toggle, Tooltip, type Column,
} from '@/components/ui'
import { moneyExact, num } from '@/lib/format'
import { useTableState } from '@/lib/hooks/useTableState'
import { cn } from '@/lib/cn'
import { DryRunPanel } from './DryRunPanel'
import { RuleSheet } from './RuleSheet'
import type { SalaryRule, SalaryStructure } from '@/api/types'

export function SalaryStructuresPage() {
  const { can } = useAuth()
  const [structureId, setStructureId] = React.useState<number | null>(null)
  const [ruleId, setRuleId] = React.useState<number | null>(null)

  // Ensure stale ?structureId= in the address bar does not auto-open the detail table on page load
  React.useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.has('structureId')) {
        url.searchParams.delete('structureId')
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''))
      }
    } catch {}
  }, [])

  const table = useTableState({ prefix: 's.', defaultSort: 'name', defaultDir: 'asc', size: 20 })
  const list = useStructures(table.params)
  const detail = useStructure(structureId)
  const detailRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (structureId !== null && detail.data) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [structureId, detail.data])

  const [editingStructure, setEditingStructure] = React.useState<SalaryStructure | null | 'new'>(null)
  const [deletingStructure, setDeletingStructure] = React.useState<SalaryStructure | null>(null)
  const saveStructure = useSaveStructure((structure) => {
    setEditingStructure(null)
    setStructureId(structure.id)
  })
  const removeStructure = useDeleteStructure(() => {
    setDeletingStructure(null)
    setStructureId(null)
  })

  const columns: Column<SalaryStructure>[] = [
    {
      key: 'name',
      header: 'Structure',
      sortable: true,
      width: '40%',
      render: (r) => (
        <div className="flex items-center gap-2.5 min-w-0">
          {r.id === structureId ? (
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent ring-4 ring-accent/20" />
          ) : null}
          <div className="min-w-0">
            <p className={cn('truncate font-medium', r.id === structureId && 'text-accent font-semibold')}>
              {r.name}
            </p>
            <p className="tnum truncate text-xs2 text-label2">{r.code}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'ruleCount',
      header: 'Rules',
      align: 'right',
      width: '20%',
      render: (r) => <span className="whitespace-nowrap">{num(r.ruleCount)}</span>,
    },
    {
      key: 'employeeCount',
      header: 'People',
      align: 'right',
      width: '20%',
      tooltip: 'Employees with a running contract on this structure.',
      render: (r) => <span className="whitespace-nowrap">{num(r.employeeCount)}</span>,
    },
    {
      key: 'active',
      header: 'Status',
      sortable: true,
      align: 'right',
      width: '20%',
      render: (r) => (
        <div className="flex justify-end whitespace-nowrap">
          <ActiveBadge active={r.active} />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Salary structures"
        description="The rules payroll runs. A contract points at one structure, and that decides how the person is paid."
        help={
          <HelpPopover title="How a structure works">
            <HelpItems
              items={[
                { term: 'Rules in order', text: 'Each rule runs at its sequence number and can use the results of every rule above it.' },
                { term: 'Categories', text: 'Basic and allowances build gross; deductions come off it; net is what remains.' },
                { term: 'Switching a rule off', text: 'Keeps it for the record but excludes it from every future calculation.' },
                { term: 'Before you save', text: 'Use the trial run to see what a change does to real people’s pay.' },
                { term: 'Past payslips', text: 'Never change. Each payrun keeps a snapshot of the rules it used.' },
              ]}
            />
          </HelpPopover>
        }
        actions={
          can('salary_structure.create') ? (
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditingStructure('new')}>
              New structure
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-6">
        <Card className="w-full">
          <DataTable
            rows={list.data?.content ?? []}
            columns={columns}
            table={table}
            total={list.data?.totalElements}
            loading={list.isLoading}
            fetching={list.isFetching}
            error={list.error}
            onRetry={() => list.refetch()}
            onRowClick={(r) => {
              setStructureId(structureId === r.id ? null : r.id)
              setRuleId(null)
            }}
            toolbar={{ search: 'Search name or code' }}
            empty={{
              icon: <Calculator className="h-6 w-6" />,
              title: 'No salary structures',
              description: 'Without one, a contract has no rules to run and the person cannot be paid.',
              action: can('salary_structure.create') ? (
                <Button variant="primary" onClick={() => setEditingStructure('new')}>Create a structure</Button>
              ) : undefined,
            }}
          />
        </Card>

        {structureId !== null && detail.data ? (
          <div ref={detailRef} className="animate-in fade-in duration-200">
            <StructureDetail
              structure={detail.data}
              openRuleId={ruleId}
              onRuleOpened={() => setRuleId(null)}
              onEdit={() => setEditingStructure(detail.data!)}
              onDelete={() => setDeletingStructure(detail.data!)}
              onClose={() => setStructureId(null)}
            />
          </div>
        ) : null}
      </div>

      <StructureSheet
        open={editingStructure !== null}
        structure={editingStructure === 'new' ? null : editingStructure}
        saving={saveStructure.isPending}
        onOpenChange={(open) => !open && setEditingStructure(null)}
        onSubmit={(body) =>
          saveStructure.mutate({ id: editingStructure === 'new' || !editingStructure ? null : editingStructure.id, body })
        }
      />

      <ConfirmDialog
        open={deletingStructure !== null}
        onOpenChange={(open) => !open && setDeletingStructure(null)}
        title={`Delete ${deletingStructure?.name}?`}
        sentence="This is refused while any contract or payrun still points at it. Switching it off instead keeps history intact."
        confirmLabel="Delete structure"
        tone="danger"
        typeToConfirm={deletingStructure?.code}
        loading={removeStructure.isPending}
        onConfirm={() => deletingStructure && removeStructure.mutate(deletingStructure.id)}
      />
    </>
  )
}

function StructureDetail({ structure, openRuleId, onRuleOpened, onEdit, onDelete, onClose }: {
  structure: SalaryStructure
  openRuleId: number | null
  onRuleOpened: () => void
  onEdit: () => void
  onDelete: () => void
  onClose?: () => void
}) {
  const { can } = useAuth()
  const canEdit = can('salary_rule.update')
  const [editingRule, setEditingRule] = React.useState<SalaryRule | null | 'new'>(null)
  const [deletingRule, setDeletingRule] = React.useState<SalaryRule | null>(null)

  const reorder = useReorderRules(structure.id)
  const setActive = useSetRuleActive(structure.id)
  const removeRule = useDeleteRule(structure.id, () => setDeletingRule(null))

  // A rule can be deep-linked from the cross-structure rules list.
  React.useEffect(() => {
    if (openRuleId === null) return
    const match = structure.rules.find((r) => r.id === openRuleId)
    if (match) { setEditingRule(match); onRuleOpened() }
  }, [openRuleId, structure.rules, onRuleOpened])

  const ordered = [...structure.rules].sort((a, b) => a.sequence - b.sequence)

  const move = (index: number, direction: -1 | 1) => {
    const next = [...ordered]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    reorder.mutate(next.map((r) => r.id))
  }

  const describe = (rule: SalaryRule) => {
    if (rule.computeType === 'FIXED') return moneyExact(rule.fixedAmount)
    if (rule.computeType === 'PERCENTAGE') return `${rule.percentage}% of ${rule.baseRuleCode}`
    return rule.formula ?? '—'
  }

  const columns: Column<SalaryRule>[] = [
    { key: 'sequence', header: 'Seq', align: 'right', width: '56px', render: (r) => r.sequence },
    {
      key: 'name',
      header: 'Rule',
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.name}</p>
          <p className="tnum truncate text-xs2 text-label2">{r.code}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (r) => (
        <Tooltip content={RULE_CATEGORY_OPTIONS.find((c) => c.value === r.category)?.description}>
          <span><Chip tone={CATEGORY_TONES[r.category]}>{r.category.toLowerCase()}</Chip></span>
        </Tooltip>
      ),
    },
    { key: 'computation', header: 'Computation', render: (r) => <span className="tnum text-sm2">{describe(r)}</span> },
    {
      key: 'active',
      header: 'On',
      tooltip: 'A rule that is off is kept but excluded from every future calculation.',
      render: (r) =>
        canEdit ? (
          <Toggle
            checked={r.active}
            disabled={setActive.isPending}
            onChange={(v) => setActive.mutate({ ruleId: r.id, active: v })}
            label={`${r.name} is active`}
          />
        ) : (
          <ActiveBadge active={r.active} labels={['On', 'Off']} />
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '132px',
      hidden: !canEdit,
      render: (r) => {
        const index = ordered.findIndex((x) => x.id === r.id)
        return (
          <span className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
            <IconButton label="Move earlier" disabled={index === 0 || reorder.isPending} onClick={() => move(index, -1)}>
              <ArrowUp className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              label="Move later"
              disabled={index === ordered.length - 1 || reorder.isPending}
              onClick={() => move(index, 1)}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton label={`Edit ${r.name}`} onClick={() => setEditingRule(r)}>
              <Pencil className="h-3.5 w-3.5" />
            </IconButton>
            {can('salary_rule.delete') ? (
              <IconButton label={`Delete ${r.name}`} onClick={() => setDeletingRule(r)}>
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            ) : null}
          </span>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={structure.name}
          subtitle={`${structure.code} · ${num(structure.ruleCount)} rules · ${num(structure.employeeCount)} people on this structure`}
          action={
            <div className="flex items-center gap-2">
              {can('salary_structure.update') ? <Button size="sm" onClick={onEdit}>Edit</Button> : null}
              {can('salary_structure.delete') ? (
                <Button size="sm" variant="danger" onClick={onDelete}>Delete</Button>
              ) : null}
              {can('salary_rule.create') ? (
                <Button size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEditingRule('new')}>
                  Add rule
                </Button>
              ) : null}
              {onClose ? (
                <IconButton label="Close rules panel" onClick={onClose}>
                  <X className="h-4 w-4" />
                </IconButton>
              ) : null}
            </div>
          }
        />
        <DataTable
          rows={ordered}
          columns={columns}
          chrome="embedded"
          onRowClick={canEdit ? (r) => setEditingRule(r) : undefined}
          empty={{
            title: 'No rules yet',
            description: 'A structure with no rules produces a payslip of zero. Add a basic pay rule to start.',
            action: can('salary_rule.create') ? (
              <Button variant="primary" onClick={() => setEditingRule('new')}>Add the first rule</Button>
            ) : undefined,
          }}
        />
        <p className="border-t border-separator px-4 py-2.5 text-xs2 text-label2">
          Rules run from the lowest sequence to the highest. Each may use the result of any rule above it, and none below.
        </p>
      </Card>

      {can('salary_structure.dry_run') ? <DryRunPanel structureId={structure.id} structureName={structure.name} /> : null}

      <RuleSheet
        open={editingRule !== null}
        onOpenChange={(open) => !open && setEditingRule(null)}
        structure={structure}
        rule={editingRule === 'new' ? null : editingRule}
      />

      <ConfirmDialog
        open={deletingRule !== null}
        onOpenChange={(open) => !open && setDeletingRule(null)}
        title={`Delete ${deletingRule?.name}?`}
        sentence="Future payslips will no longer include this line. Payslips already produced keep it, because they are never recalculated."
        confirmLabel="Delete rule"
        tone="danger"
        loading={removeRule.isPending}
        onConfirm={() => deletingRule && removeRule.mutate(deletingRule.id)}
      />
    </div>
  )
}

function StructureSheet({ open, structure, saving, onOpenChange, onSubmit }: {
  open: boolean
  structure: SalaryStructure | null
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (body: Record<string, unknown>) => void
}) {
  const [form, setForm] = React.useState({ name: '', code: '', active: true })
  React.useEffect(() => {
    if (!open) return
    setForm(structure ? { name: structure.name, code: structure.code, active: structure.active } : { name: '', code: '', active: true })
  }, [open, structure])

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={structure ? `Edit ${structure.name}` : 'New salary structure'}
      description="A structure is a named set of rules. Contracts point at one, and that decides how those people are paid."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!form.name.trim() || !form.code.trim()}
            onClick={() => onSubmit({ name: form.name.trim(), code: form.code.trim().toUpperCase(), active: form.active })}
          >
            {structure ? 'Save' : 'Create structure'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required>
          <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Standard Monthly" />
        </Field>
        <Field label="Code" required hint="A short, stable identifier used in exports and reports.">
          <TextInput
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="STD_MONTHLY"
          />
        </Field>
        <div className="flex items-center justify-between rounded-card border border-separator px-4 py-3">
          <div>
            <p className="text-sm2 font-medium">Available</p>
            <p className="text-xs2 text-label2">Contracts already using it keep working; it is no longer offered for new ones.</p>
          </div>
          <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Available" />
        </div>
      </div>
    </Sheet>
  )
}
