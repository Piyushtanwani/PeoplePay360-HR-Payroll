import * as React from 'react'
import { Play } from 'lucide-react'
import { useDryRun } from '@/api/hooks'
import {
  Button, Callout, Card, CardHeader, DataTable, HelpItems, HelpPopover, KpiCard, Select, type Column,
} from '@/components/ui'
import { lastClosedPeriod, recentPeriods } from '@/lib/dates'
import { fmtPeriod, money, moneyExact, num } from '@/lib/format'
import { errorText } from '@/api/mutation'
import type { DryRunRow } from '@/api/types'

/**
 * Simulates a structure against real people and writes nothing.
 *
 * The point is to answer "what does this rule change do to people's pay" before saving. The totals sit
 * on top because that is the question, and anyone whose pay would go below zero is named outright:
 * a negative net is not a smaller number, it is a rule set that cannot be used.
 */
export function DryRunPanel({ structureId, structureName }: { structureId: number; structureName: string }) {
  const [period, setPeriod] = React.useState(lastClosedPeriod())
  const dryRun = useDryRun(structureId)
  const result = dryRun.data

  const columns: Column<DryRunRow & { id: number }>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.employeeName}</p>
          <p className="tnum truncate text-xs2 text-label2">{r.employeeNo}</p>
        </div>
      ),
    },
    {
      key: 'currentNet',
      header: 'Current net',
      align: 'right',
      tooltip: 'Their most recent actual payslip. Empty when they have never been paid.',
      render: (r) => (r.currentNet === null ? '—' : moneyExact(r.currentNet)),
    },
    {
      key: 'newNet',
      header: 'Simulated net',
      align: 'right',
      render: (r) => (
        <span className={r.negative ? 'font-semibold text-bad' : 'font-semibold'}>{moneyExact(r.newNet)}</span>
      ),
    },
    {
      key: 'delta',
      header: 'Change',
      align: 'right',
      render: (r) =>
        r.delta === null ? (
          <span className="text-label2">No comparison</span>
        ) : (
          <span className={r.delta < 0 ? 'text-bad' : r.delta > 0 ? 'text-ok' : undefined}>
            {r.delta === 0 ? '—' : moneyExact(r.delta, { sign: true })}
          </span>
        ),
    },
  ]

  const negatives = result?.results.filter((r) => r.negative) ?? []

  return (
    <Card>
      <CardHeader
        title="Try it out"
        subtitle="Runs the rules against real people and real attendance. Nothing is saved."
        help={
          <HelpPopover title="What a trial run does">
            <HelpItems
              items={[
                { term: 'Real data', text: 'The same contracts, attendance and leave a payrun would use for that month.' },
                { term: 'Nothing is written', text: 'No payslip, no payrun, no change to anybody’s pay.' },
                { term: 'The comparison', text: 'Against each person’s most recent payslip, whenever that was.' },
                { term: 'Negative net', text: 'Deductions exceeding gross. Payroll would accept the figure, so it is flagged here instead.' },
              ]}
            />
          </HelpPopover>
        }
        action={
          <div className="flex items-center gap-2">
            <Select
              value={period}
              onChange={setPeriod}
              className="w-44"
              options={recentPeriods(12).map((p) => ({ value: p, label: fmtPeriod(p) }))}
            />
            <Button
              variant="primary"
              icon={<Play className="h-4 w-4" />}
              loading={dryRun.isPending}
              onClick={() => dryRun.mutate({ period })}
            >
              Run
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-5">
        {dryRun.isError ? <Callout tone="bad" title="Could not run">{errorText(dryRun.error)}</Callout> : null}

        {!result && !dryRun.isPending && !dryRun.isError ? (
          <p className="py-6 text-center text-sm2 text-label2">
            Choose a month and run it to see what {structureName} would pay, without changing anything.
          </p>
        ) : null}

        {result ? (
          <>
            {negatives.length > 0 ? (
              <Callout
                tone="bad"
                title={`${negatives.length} ${negatives.length === 1 ? 'person' : 'people'} would be paid a negative amount`}
              >
                Deductions come to more than gross pay for {negatives.map((r) => r.employeeName).join(', ')}. This rule
                set cannot be used as it stands.
              </Callout>
            ) : null}

            {result.totals.skipped.length > 0 ? (
              <Callout tone="warn" title={`${result.totals.skipped.length} skipped`}>
                {result.totals.skipped.join(' ')}
              </Callout>
            ) : null}

            {/* Totals on top, because "what does this cost" is the question being asked. */}
            <div className="grid gap-3 sm:grid-cols-3">
              <KpiCard
                label="Currently paid"
                value={money(result.totals.totalCurrentNet)}
                hint={`Across ${num(result.totals.employeeCount)} people`}
              />
              <KpiCard label="Would be paid" value={money(result.totals.totalNewNet)} hint={fmtPeriod(period)} />
              <KpiCard
                label="Difference"
                value={moneyExact(result.totals.totalDelta, { sign: true })}
                hint={result.totals.totalDelta < 0 ? 'Lower than the current bill' : 'Higher than the current bill'}
                tone={result.totals.totalDelta < 0 ? 'bad' : result.totals.totalDelta > 0 ? 'warn' : 'neutral'}
              />
            </div>

            <div className="rounded-card border border-separator">
              <DataTable
                rows={result.results.map((r) => ({ ...r, id: r.employeeId }))}
                columns={columns}
                chrome="embedded"
                summaryRow={{
                  employee: 'Total',
                  currentNet: moneyExact(result.totals.totalCurrentNet),
                  newNet: moneyExact(result.totals.totalNewNet),
                  delta: moneyExact(result.totals.totalDelta, { sign: true }),
                }}
                empty={{
                  title: 'Nobody to simulate',
                  description: 'No employee holds a running contract on this structure for the chosen month.',
                }}
              />
            </div>

            {result.totals.warnings.length > 0 ? (
              <details className="text-sm2 text-label2">
                <summary className="cursor-pointer">{result.totals.warnings.length} notes from the calculation</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {result.totals.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
                </ul>
              </details>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
  )
}
