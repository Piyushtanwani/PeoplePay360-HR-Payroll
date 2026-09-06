import { useNavigate } from 'react-router-dom'
import { ListOrdered } from 'lucide-react'
import { useAllRules, useStructureNames } from '@/api/hooks'
import { CATEGORY_TONES, RULE_CATEGORY_OPTIONS } from '@/api/constants'
import { useAuth } from '@/auth/AuthProvider'
import {
  Card, Chip, DataTable, HelpItems, HelpPopover, PageHeader, Select, Tooltip,
  type Column,
} from '@/components/ui'
import { moneyExact } from '@/lib/format'
import { useNumberParamState, useSearchParamState } from '@/lib/hooks/useSearchParamState'
import { useTableState } from '@/lib/hooks/useTableState'
import type { SalaryRuleRow } from '@/api/types'

/**
 * Every rule across every structure, for answering "where is tax calculated" without opening each
 * structure in turn. Editing happens on the structure, which is where the ordering makes sense.
 */
export function SalaryRulesPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const structures = useStructureNames()

  const [structureId, setStructureId] = useNumberParamState('structureId')
  const [category, setCategory] = useSearchParamState<string>('category', '')
  const [active, setActive] = useSearchParamState<string>('active', '')

  // Structure, then sequence: the order the rules actually run in.
  const table = useTableState({ defaultSort: 'structureName', defaultDir: 'asc' })
  const list = useAllRules({
    ...table.params,
    structureId,
    category: category || undefined,
    active: active === '' ? undefined : active === 'true',
  })

  const describe = (rule: SalaryRuleRow) => {
    if (rule.computeType === 'FIXED') return moneyExact(rule.fixedAmount)
    if (rule.computeType === 'PERCENTAGE') return `${rule.percentage}% of ${rule.baseRuleCode}`
    return rule.formula ?? '—'
  }

  const columns: Column<SalaryRuleRow>[] = [
    { key: 'structureName', header: 'Structure', sortable: true, render: (r) => r.structureName },
    { key: 'sequence', header: 'Seq', align: 'right', sortable: true, width: '56px', render: (r) => r.sequence },
    {
      key: 'name',
      header: 'Rule',
      sortable: true,
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
      sortable: true,
      render: (r) => (
        <Tooltip content={RULE_CATEGORY_OPTIONS.find((c) => c.value === r.category)?.description}>
          <span><Chip tone={CATEGORY_TONES[r.category]}>{r.category.toLowerCase()}</Chip></span>
        </Tooltip>
      ),
    },
    { key: 'computation', header: 'Computation', render: (r) => <span className="tnum text-sm2">{describe(r)}</span> },
  ]

  return (
    <>
      <PageHeader
        title="Salary rules"
        description="Every rule in every structure, in the order it runs. Open one to edit it on its structure."
        help={
          <HelpPopover title="Reading this list">
            <HelpItems
              items={[
                { term: 'Order', text: 'Grouped by structure, then by sequence, which is the order payroll runs them in.' },
                { term: 'Computation', text: 'A fixed amount, a percentage of an earlier rule, or a formula.' },
                { term: 'On and off', text: 'Switched here on the structure page, so the effect of the change is visible next to its neighbours.' },
              ]}
            />
          </HelpPopover>
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
          onRowClick={
            can('salary_structure.read')
              ? (r) => navigate(`/payroll/salary-structures?structureId=${r.structureId}&ruleId=${r.id}`)
              : undefined
          }
          toolbar={{
            search: 'Search rule name, code or structure',
            filters: (
              <>
                <Select
                  value={structureId}
                  onChange={setStructureId}
                  clearable
                  onClear={() => setStructureId(null)}
                  placeholder="All structures"
                  className="w-52"
                  options={(structures.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
                />
                <Select
                  value={category}
                  onChange={setCategory}
                  className="w-44"
                  options={[{ value: '', label: 'All categories' }, ...RULE_CATEGORY_OPTIONS]}
                />
                <Select
                  value={active}
                  onChange={setActive}
                  className="w-36"
                  options={[
                    { value: '', label: 'On and off' },
                    { value: 'true', label: 'On only' },
                    { value: 'false', label: 'Off only' },
                  ]}
                />
              </>
            ),
          }}
          empty={{
            icon: <ListOrdered className="h-6 w-6" />,
            title: 'No rules',
            description: 'Rules are added to a salary structure, and appear here across all of them.',
          }}
        />
      </Card>
    </>
  )
}
