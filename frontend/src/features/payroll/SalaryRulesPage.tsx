import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { FileSpreadsheet, Search } from 'lucide-react'
import { api } from '@/api/client'
import { Card, Chip, DataTable, EmptyState, PageHeader, Select, StatusBadge, TextInput } from '@/components/ui'
import { money } from '@/lib/format'
import type { Column } from '@/components/ui/DataTable'
import type { SalaryRuleRow } from '@/api/types'

const CATEGORIES = [
  { value: 'BASIC', label: 'Basic' },
  { value: 'ALLOWANCE', label: 'Allowance' },
  { value: 'GROSS', label: 'Gross' },
  { value: 'DEDUCTION', label: 'Deduction' },
  { value: 'NET', label: 'Net' },
]

function computation(rule: SalaryRuleRow) {
  if (rule.computeType === 'FIXED') return rule.fixedAmount === null ? 'Fixed' : `Fixed ${money(rule.fixedAmount)}`
  if (rule.computeType === 'PERCENTAGE') return `${rule.percentage ?? 0}% of ${rule.baseRuleCode ?? '—'}`
  return rule.formula ? `Formula: ${rule.formula}` : 'Formula'
}

export function SalaryRulesPage() {
  const navigate = useNavigate()
  const [q, setQ] = React.useState('')
  const [category, setCategory] = React.useState<string | null>(null)
  const [structureId, setStructureId] = React.useState<number | null>(null)

  const query = useQuery({
    queryKey: ['salary-rules'],
    queryFn: () => api.get<SalaryRuleRow[]>('/api/salary-structures/rules/all'),
  })

  const all = query.data ?? []
  const structures = React.useMemo(() => {
    const seen = new Map<number, string>()
    all.forEach((r) => seen.set(r.structureId, r.structureName))
    return Array.from(seen, ([value, label]) => ({ value, label }))
  }, [all])

  const rows = all.filter((r) => {
    if (category && r.category !== category) return false
    if (structureId !== null && r.structureId !== structureId) return false
    if (!q) return true
    const needle = q.toLowerCase()
    return `${r.name} ${r.code} ${r.structureName}`.toLowerCase().includes(needle)
  })

  const columns: Column<SalaryRuleRow>[] = [
    { key: 'name', header: 'Rule name', render: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
    { key: 'code', header: 'Code', render: (r) => <span className="font-mono text-sm2">{r.code}</span>, sortValue: (r) => r.code },
    { key: 'category', header: 'Category', render: (r) => <Chip>{r.category.toLowerCase()}</Chip>, sortValue: (r) => r.category },
    { key: 'structure', header: 'Structure', render: (r) => r.structureName, sortValue: (r) => r.structureName },
    { key: 'sequence', header: 'Sequence', align: 'right', render: (r) => <span className="tnum">{r.sequence}</span>, sortValue: (r) => r.sequence },
    { key: 'computation', header: 'Computation', render: (r) => <span className="text-label2">{computation(r)}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.active ? 'ACTIVE' : 'CANCELLED'} /> },
  ]

  return (
    <>
      <PageHeader
        title="Salary rules"
        description="Every rule across all structures, in the order payroll applies them. Open a rule to edit it on its structure."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-label2" />
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rules…" className="pl-8" />
        </div>
        <Select value={structureId} onChange={setStructureId} clearable onClear={() => setStructureId(null)}
          placeholder="All structures" options={structures} />
        <Select value={category} onChange={setCategory} clearable onClear={() => setCategory(null)}
          placeholder="All categories" options={CATEGORIES} />
        <p className="self-center text-sm2 text-label2">
          {query.isLoading ? 'Loading…' : `${rows.length} rule${rows.length === 1 ? '' : 's'}`}
        </p>
      </div>

      <Card>
        <DataTable
          rows={rows}
          columns={columns}
          loading={query.isLoading}
          onRowClick={(r) => navigate(`/payroll/salary-structures?structureId=${r.structureId}&ruleId=${r.id}`)}
          empty={<EmptyState icon={<FileSpreadsheet className="h-6 w-6" />} title="No rules match"
            description="Clear the filters, or add rules from a salary structure." />}
        />
      </Card>
    </>
  )
}
