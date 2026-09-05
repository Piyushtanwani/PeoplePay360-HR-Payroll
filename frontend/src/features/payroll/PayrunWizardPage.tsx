import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { useCreatePayrun, useDepartments, useEligibility, useStructureNames } from '@/api/hooks'
import {
  Button, Callout, Card, CardHeader, Chip, DataTable, DateField, Field, HelpItems, HelpPopover,
  MonthPicker, Select, Toggle, Tooltip, type Column,
} from '@/components/ui'
import { currentPeriod, monthBounds } from '@/lib/dates'
import { fmtPeriod, fmtRange, num } from '@/lib/format'
import { useTableState } from '@/lib/hooks/useTableState'
import type { EligibleEmployee } from '@/api/types'

/**
 * Creating a payrun, in two steps: what period and rules, then who is in it.
 *
 * Nothing is written until the last button. The eligibility check is what stops someone being paid
 * twice for the same period, so an ineligible row stays visible with its reason rather than vanishing.
 */
export function PayrunWizardPage() {
  const navigate = useNavigate()
  const structures = useStructureNames()
  const departments = useDepartments()

  const [step, setStep] = React.useState<1 | 2>(1)
  const [structureId, setStructureId] = React.useState<number | null>(null)
  const [period, setPeriod] = React.useState(currentPeriod())
  const [customRange, setCustomRange] = React.useState(false)
  const [range, setRange] = React.useState(monthBounds(currentPeriod()))
  const [selected, setSelected] = React.useState<Set<number>>(new Set())
  const [departmentFilter, setDepartmentFilter] = React.useState<number | null>(null)

  React.useEffect(() => { if (!customRange) setRange(monthBounds(period)) }, [period, customRange])

  const eligibility = useEligibility()
  const create = useCreatePayrun((payrun) => navigate(`/payroll/payruns/${payrun.id}`))
  // Every eligible employee arrives at once so they can all be selected; the table pages them.
  const table = useTableState({ url: false, size: 50, defaultSort: 'displayName' })

  const structureName = structures.data?.find((s) => s.id === structureId)?.name ?? ''
  const payrunName = fmtPeriod(period)

  const loadEligibility = () => {
    if (!structureId) return
    eligibility.mutate(
      { structureId, periodStart: range.start, periodEnd: range.end },
      {
        onSuccess: (rows) => {
          // Everyone who can be paid starts selected; the exceptions are the point of the review.
          setSelected(new Set(rows.filter((r) => r.eligible).map((r) => r.employeeId)))
          setStep(2)
        },
      },
    )
  }

  const rows = (eligibility.data ?? [])
    .filter((row) => !departmentFilter || row.departmentName === departments.data?.find((d) => d.id === departmentFilter)?.name)
    .map((row) => ({ ...row, id: row.employeeId }))
  const eligibleCount = rows.filter((r) => r.eligible).length
  const ineligibleCount = rows.length - eligibleCount

  const columns: Column<EligibleEmployee & { id: number }>[] = [
    {
      key: 'displayName',
      header: 'Employee',
      sortValue: (r) => r.displayName,
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.displayName}</p>
          <p className="tnum truncate text-xs2 text-label2">{r.employeeNo}</p>
        </div>
      ),
    },
    { key: 'departmentName', header: 'Department', sortValue: (r) => r.departmentName ?? '', render: (r) => r.departmentName ?? '—' },
    {
      key: 'contract',
      header: 'Contract',
      render: (r) => <span className="tnum">{r.contractReference ?? '—'}</span>,
    },
    { key: 'structure', header: 'Salary structure', render: (r) => r.contractStructureName ?? '—' },
    {
      key: 'eligible',
      header: 'Can be paid',
      render: (r) =>
        r.eligible ? (
          <Chip tone="ok">Yes</Chip>
        ) : (
          <Tooltip content={r.reason ?? 'Not eligible'}>
            <span><Chip tone="bad">{r.reason ?? 'No'}</Chip></span>
          </Tooltip>
        ),
    },
  ]

  return (
    <>
      <button
        onClick={() => navigate('/payroll/payruns')}
        className="mb-3 inline-flex items-center gap-1.5 text-sm2 text-label2 hover:text-label"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to payruns
      </button>

      <div className="mb-6 flex items-center gap-3">
        {[
          { n: 1, label: 'Period and rules' },
          { n: 2, label: 'Who is included' },
        ].map(({ n, label }) => (
          <React.Fragment key={n}>
            <span className="flex items-center gap-2">
              <span
                className={
                  step >= n
                    ? 'flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs2 font-semibold text-white'
                    : 'flex h-7 w-7 items-center justify-center rounded-full bg-surface2 text-xs2 font-semibold text-label2'
                }
              >
                {step > n ? <Check className="h-3.5 w-3.5" /> : n}
              </span>
              <span className={step >= n ? 'text-sm2 font-medium' : 'text-sm2 text-label2'}>{label}</span>
            </span>
            {n === 1 ? <span className="h-px w-8 bg-separator" aria-hidden /> : null}
          </React.Fragment>
        ))}
      </div>

      {step === 1 ? (
        <Card className="max-w-2xl">
          <CardHeader
            title="What is being paid, and for when"
            subtitle="Nothing is created yet. The next step shows who would be included."
            help={
              <HelpPopover title="Choosing the period">
                <HelpItems
                  items={[
                    { term: 'The month', text: 'Most payruns cover a calendar month, which is what the picker offers.' },
                    { term: 'Custom dates', text: 'For a part-month run, such as a mid-month joiner or a final payment.' },
                    { term: 'The structure', text: 'Only people whose contract points at this structure can be included.' },
                  ]}
                />
              </HelpPopover>
            }
          />
          <div className="space-y-4 p-5">
            <Field
              label="Salary structure"
              required
              hint="The rules to run. Someone on a different structure needs their own payrun."
            >
              <Select
                value={structureId}
                onChange={setStructureId}
                options={(structures.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
                placeholder="Select a structure"
              />
            </Field>

            <Field label="Period" required>
              <MonthPicker value={period} onChange={setPeriod} className="w-56" />
            </Field>

            <div className="flex items-center justify-between rounded-card border border-separator px-4 py-3">
              <div>
                <p className="text-sm2 font-medium">Use exact dates instead</p>
                <p className="text-xs2 text-label2">For a part-month run, such as a final payment.</p>
              </div>
              <Toggle checked={customRange} onChange={setCustomRange} label="Use exact dates" />
            </div>

            {customRange ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="From" required>
                  <DateField value={range.start} onChange={(v) => setRange({ ...range, start: v })} />
                </Field>
                <Field label="To" required>
                  <DateField value={range.end} min={range.start} onChange={(v) => setRange({ ...range, end: v })} />
                </Field>
              </div>
            ) : null}

            {structureId ? (
              <Callout tone="neutral" title="This payrun will be called">
                {payrunName} · {structureName} · {fmtRange(range.start, range.end)}
              </Callout>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-separator px-5 py-3">
            <Button onClick={() => navigate('/payroll/payruns')}>Cancel</Button>
            <Button variant="primary" loading={eligibility.isPending} disabled={!structureId} onClick={loadEligibility}>
              Continue
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Who is included"
            subtitle={`${num(selected.size)} selected · ${num(eligibleCount)} can be paid · ${num(ineligibleCount)} cannot`}
            help={
              <HelpPopover title="Why someone cannot be paid">
                <HelpItems
                  items={[
                    { term: 'No contract in the period', text: 'Payroll has no wage or rules to use for them.' },
                    { term: 'Already on a payrun', text: 'They have a payslip for an overlapping period. Paying twice is prevented here.' },
                    { term: 'Only a draft contract', text: 'A draft is not in force. Activate it first.' },
                    { term: 'Inactive', text: 'Deactivated people are excluded from every payrun.' },
                  ]}
                />
              </HelpPopover>
            }
            action={
              <Select
                value={departmentFilter}
                onChange={setDepartmentFilter}
                clearable
                onClear={() => setDepartmentFilter(null)}
                placeholder="All departments"
                className="w-52"
                options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
              />
            }
          />
          <DataTable
            rows={rows}
            columns={columns}
            table={table}
            searchKeys={[(r) => r.displayName, (r) => r.employeeNo]}
            selectable
            selectedIds={selected}
            onSelectionChange={setSelected}
            rowDisabled={(r) => !r.eligible}
            toolbar={{ search: 'Search by name or number' }}
            empty={{
              title: 'Nobody to include',
              description: 'No employee holds a contract on this structure covering the chosen dates.',
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-separator px-5 py-3">
            <p className="text-sm2 text-label2">
              {selected.size === 0
                ? 'Select at least one person to create the payrun.'
                : `${num(selected.size)} ${selected.size === 1 ? 'person' : 'people'} will get a payslip for ${fmtRange(range.start, range.end)}.`}
            </p>
            <div className="flex items-center gap-2">
              <Button onClick={() => setStep(1)}>Back</Button>
              <Button
                variant="primary"
                loading={create.isPending}
                disabled={selected.size === 0}
                onClick={() =>
                  create.mutate({
                    name: payrunName,
                    structureId,
                    periodStart: range.start,
                    periodEnd: range.end,
                    employeeIds: Array.from(selected),
                  })
                }
              >
                Create payrun
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  )
}
