import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import {
  Button, Callout, Card, CardHeader, Chip, DataTable, Field, MoneyInput, PageHeader, PercentInput,
  SegmentedControl, Select, Sheet, StatusBadge, TextArea, TextInput, useToast,
} from '@/components/ui'
import { money } from '@/lib/format'
import type { ComputeType, Page, RuleCategory, SalaryRule, SalaryStructure } from '@/api/types'

const CATEGORIES: { value: RuleCategory; label: string }[] = [
  { value: 'BASIC', label: 'Basic' }, { value: 'ALLOWANCE', label: 'Allowance' }, { value: 'GROSS', label: 'Gross' },
  { value: 'DEDUCTION', label: 'Deduction' }, { value: 'NET', label: 'Net' },
]

export function SalaryStructuresPage() {
  const { can } = useAuth()
  const [selectedId, setSelectedId] = React.useState<number | null>(null)

  const structures = useQuery({ queryKey: ['structures'], queryFn: () => api.get<Page<SalaryStructure>>('/api/salary-structures', { size: 50 }) })
  const detail = useQuery({
    queryKey: ['structure', selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => api.get<SalaryStructure>(`/api/salary-structures/${selectedId}`),
  })

  return (
    <>
      <PageHeader
        title="Salary structures"
        description="A structure groups the ordered salary rules that calculate every payslip. Rule sequence is the calculation order."
      />

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader title="Structures" subtitle={`${structures.data?.totalElements ?? 0} configured`} />
          <DataTable
            rows={structures.data?.content ?? []}
            loading={structures.isLoading}
            onRowClick={(row) => setSelectedId(row.id)}
            columns={[
              { key: 'name', header: 'Structure', render: (r) => <span className={`font-medium ${r.id === selectedId ? 'text-accent' : ''}`}>{r.name}</span> },
              { key: 'rules', header: 'Rules', align: 'right', render: (r) => r.ruleCount },
              { key: 'employees', header: 'Employees', align: 'right', render: (r) => r.employeeCount },
              { key: 'status', header: '', render: (r) => <StatusBadge status={r.active ? 'ACTIVE' : 'CANCELLED'} /> },
            ]}
          />
        </Card>

        {selectedId && detail.data ? (
          <StructureDetail structure={detail.data} canEdit={can('salary_rule.update')} canCreate={can('salary_rule.create')} canDelete={can('salary_rule.delete')} canDryRun={can('salary_structure.dry_run')} />
        ) : (
          <Card className="grid place-items-center p-12 text-center">
            <div>
              <p className="text-[17px] font-semibold">Select a structure</p>
              <p className="mt-1 text-sm2 text-label2">Open a salary structure to review its rules and computation order.</p>
            </div>
          </Card>
        )}
      </div>
    </>
  )
}

function StructureDetail({ structure, canEdit, canCreate, canDelete, canDryRun }: {
  structure: SalaryStructure
  canEdit: boolean
  canCreate: boolean
  canDelete: boolean
  canDryRun: boolean
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [editing, setEditing] = React.useState<SalaryRule | 'new' | null>(null)

  const rules = [...structure.rules].sort((a, b) => a.sequence - b.sequence)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['structure', structure.id] })
    queryClient.invalidateQueries({ queryKey: ['structures'] })
  }

  const reorder = useMutation({
    mutationFn: (orderedRuleIds: number[]) => api.put(`/api/salary-structures/${structure.id}/rules/reorder`, { orderedRuleIds }),
    onSuccess: invalidate,
  })

  const save = useMutation({
    mutationFn: (rule: Partial<SalaryRule>) =>
      rule.id
        ? api.put<SalaryRule>(`/api/salary-structures/${structure.id}/rules/${rule.id}`, rule)
        : api.post<SalaryRule>(`/api/salary-structures/${structure.id}/rules`, rule),
    onSuccess: () => { invalidate(); setEditing(null); toast.push({ tone: 'success', title: 'Salary rule saved' }) },
    onError: (error) => toast.push({ tone: 'error', title: 'Could not save rule', detail: error instanceof ApiError ? error.detail : '' }),
  })

  const remove = useMutation({
    mutationFn: (ruleId: number) => api.del(`/api/salary-structures/${structure.id}/rules/${ruleId}`),
    onSuccess: () => { invalidate(); toast.push({ tone: 'info', title: 'Salary rule deleted' }) },
  })

  const move = (index: number, direction: -1 | 1) => {
    const next = [...rules]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    reorder.mutate(next.map((r) => r.id))
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={structure.name}
          subtitle={`${structure.ruleCount} rules · ${structure.employeeCount} employees · code ${structure.code}`}
          action={canCreate ? <Button size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEditing('new')}>New rule</Button> : undefined}
        />
        <table className="w-full text-body">
          <thead>
            <tr className="border-b border-separator text-left text-xs2 uppercase tracking-wide text-label2">
              <th className="px-4 py-2 w-16">Seq</th><th className="px-4 py-2">Rule name</th><th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Category</th><th className="px-4 py-2">Computation</th><th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, index) => (
              <tr key={rule.id} className="border-b border-separator/60 last:border-0 hover:bg-surface2">
                <td className="tnum px-4 py-2 text-label2">{rule.sequence}</td>
                <td className="px-4 py-2">
                  <button className="font-medium hover:text-accent" onClick={() => setEditing(rule)}>{rule.name}</button>
                </td>
                <td className="tnum px-4 py-2 text-label2">{rule.code}</td>
                <td className="px-4 py-2">
                  <Chip tone={rule.category === 'DEDUCTION' ? 'bad' : rule.category === 'NET' ? 'ok' : rule.category === 'GROSS' ? 'teal' : 'neutral'}>
                    {rule.category.toLowerCase()}
                  </Chip>
                </td>
                <td className="px-4 py-2 text-label2">
                  {rule.computeType === 'FIXED' ? money(rule.fixedAmount)
                    : rule.computeType === 'PERCENTAGE' ? `${rule.percentage}% of ${rule.baseRuleCode ?? 'WAGE'}`
                    : 'Formula'}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-end gap-1">
                    {canEdit ? (
                      <>
                        <button aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)} className="text-label2 hover:text-label disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button aria-label="Move down" disabled={index === rules.length - 1} onClick={() => move(index, 1)} className="text-label2 hover:text-label disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                      </>
                    ) : null}
                    {canDelete ? (
                      <button aria-label="Delete rule" onClick={() => remove.mutate(rule.id)} className="ml-1 text-label2 hover:text-bad"><Trash2 className="h-3.5 w-3.5" /></button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-separator px-4 py-3 text-xs2 text-label2">
          Rule order matters — each rule can reference the categories computed before it.
        </p>
      </Card>

      {canDryRun ? <DryRunPanel structureId={structure.id} /> : null}

      {editing ? (
        <RuleSheet
          rule={editing === 'new' ? null : editing}
          rules={rules}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSave={(rule) => save.mutate(rule)}
        />
      ) : null}
    </div>
  )
}

function DryRunPanel({ structureId }: { structureId: number }) {
  const [period, setPeriod] = React.useState('2026-09')
  const [result, setResult] = React.useState<{ employeeId: number; employeeName: string; currentNet: number; newNet: number; delta: number }[] | null>(null)

  const employees = useQuery({ queryKey: ['employees', 'options'], queryFn: () => api.get<Page<{ id: number; displayName: string; employeeNo: string }>>('/api/employees', { size: 20 }) })

  const run = useMutation({
    mutationFn: (employeeIds: number[]) => api.post<{ results: typeof result }>(`/api/salary-structures/${structureId}/dry-run`, { employeeIds, period }),
    onSuccess: (data) => setResult(data.results ?? []),
  })

  const ids = (employees.data?.content ?? []).slice(0, 5).map((e) => e.id)

  return (
    <Card>
      <CardHeader title="Dry run" subtitle="Preview the effect of this structure on a sample of employees. Nothing is saved." />
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <Select className="w-48" value={period} onChange={setPeriod} options={['2026-09', '2026-08', '2026-07'].map((p) => ({ value: p, label: p }))} />
        <Button variant="primary" loading={run.isPending} onClick={() => run.mutate(ids)}>Run on 5 employees</Button>
      </div>
      {result ? (
        <DataTable
          rows={result.map((r) => ({ ...r, id: r.employeeId }))}
          columns={[
            { key: 'name', header: 'Employee', render: (r) => r.employeeName },
            { key: 'current', header: 'Current net', align: 'right', render: (r) => money(r.currentNet) },
            { key: 'new', header: 'New net', align: 'right', render: (r) => money(r.newNet) },
            { key: 'delta', header: 'Delta', align: 'right', render: (r) => <span className={r.delta >= 0 ? 'text-ok' : 'text-bad'}>{r.delta >= 0 ? '+' : ''}{money(r.delta)}</span> },
          ]}
        />
      ) : null}
    </Card>
  )
}

function RuleSheet({ rule, rules, onClose, onSave, saving }: {
  rule: SalaryRule | null
  rules: SalaryRule[]
  onClose: () => void
  onSave: (rule: Partial<SalaryRule>) => void
  saving: boolean
}) {
  const [form, setForm] = React.useState<Partial<SalaryRule>>(
    rule ?? { name: '', code: '', category: 'ALLOWANCE', computeType: 'FIXED', fixedAmount: 0, sequence: (rules.length + 1) * 10 },
  )
  const set = <K extends keyof SalaryRule>(key: K, value: SalaryRule[K]) => setForm((f) => ({ ...f, [key]: value }))

  const help = useQuery({ queryKey: ['formula-help'], queryFn: () => api.get<{ variables: { name: string; description: string }[]; functions: string[]; example: string }>('/api/salary-structures/formula-help') })
  const earlierRules = rules.filter((r) => !rule || r.sequence < (form.sequence ?? 0))

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && onClose()}
      width="lg"
      title={rule ? `Salary rule · ${rule.name}` : 'New salary rule'}
      description="A rule needs a clear computation method and category; both drive the lines shown on the payslip."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} disabled={!form.name || !form.code} onClick={() => onSave(form)}>Save rule</Button></>}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rule name" required><TextInput value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="House Rent Allowance" /></Field>
          <Field label="Code" required hint="Uppercased automatically."><TextInput value={form.code ?? ''} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="HRA" /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" required><Select value={form.category ?? 'ALLOWANCE'} onChange={(v) => set('category', v)} options={CATEGORIES} /></Field>
          <Field label="Sequence" required hint="Lower numbers are computed first.">
            <input type="number" value={form.sequence ?? 0} onChange={(e) => set('sequence', Number(e.target.value))}
              className="tnum h-9 w-full rounded-control border border-separator bg-surface px-3 outline-none focus:border-accent" />
          </Field>
        </div>

        <Field label="Computation" required>
          <SegmentedControl
            value={form.computeType ?? 'FIXED'}
            onChange={(v) => set('computeType', v as ComputeType)}
            options={[{ value: 'FIXED', label: 'Fixed amount' }, { value: 'PERCENTAGE', label: 'Percentage' }, { value: 'FORMULA', label: 'Formula' }]}
          />
        </Field>

        {form.computeType === 'FIXED' ? (
          <Field label="Amount" required><MoneyInput value={form.fixedAmount ?? 0} onChange={(v) => set('fixedAmount', v)} /></Field>
        ) : form.computeType === 'PERCENTAGE' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Percentage" required><PercentInput value={form.percentage ?? 0} onChange={(v) => set('percentage', v)} /></Field>
            <Field label="Base" required hint="Only rules computed earlier can be used as a base.">
              <Select
                value={form.baseRuleCode ?? 'WAGE'}
                onChange={(v) => set('baseRuleCode', v)}
                options={[{ value: 'WAGE', label: 'Contract wage' }, ...earlierRules.map((r) => ({ value: r.code, label: `${r.name} (${r.code})` }))]}
              />
            </Field>
          </div>
        ) : (
          <>
            <Field label="Formula" required hint="Assign the computed value to `result`.">
              <TextArea value={form.formula ?? ''} onChange={(e) => set('formula', e.target.value)} placeholder="result = categories['BASIC'] * worked_days / scheduled_days" className="font-mono text-sm2" />
            </Field>
            {help.data ? (
              <Callout tone="neutral" title="Available variables">
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {help.data.variables.map((variable) => (
                    <button key={variable.name} title={variable.description}
                      onClick={() => set('formula', `${form.formula ?? ''}${variable.name}`)}
                      className="rounded-full bg-surface px-2 py-0.5 font-mono text-xs2 text-accent hover:brightness-110">
                      {variable.name}
                    </button>
                  ))}
                </div>
                <p className="mt-2 font-mono text-xs2">{help.data.example}</p>
              </Callout>
            ) : null}
          </>
        )}

        <Field label="Description"><TextArea value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field>
      </div>
    </Sheet>
  )
}
