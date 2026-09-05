import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderPage } from '@/test/render'
import { ApiError } from '@/api/client'
import type { DryRunResult } from '@/api/types'

const dryRun = {
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null as unknown,
  data: undefined as DryRunResult | undefined,
}
vi.mock('@/api/hooks', () => ({ useDryRun: () => dryRun }))

import { DryRunPanel } from './DryRunPanel'

function row(over: Partial<DryRunResult['results'][number]> = {}) {
  return {
    employeeId: 1, employeeName: 'Ana Silva', employeeNo: 'EMP001',
    currentNet: 50000, newNet: 48000, delta: -2000, negative: false, lines: [],
    ...over,
  }
}

function result(over: Partial<DryRunResult> = {}): DryRunResult {
  return {
    results: [row()],
    totals: {
      totalCurrentNet: 50000, totalNewNet: 48000, totalDelta: -2000,
      employeeCount: 1, negativeEmployeeIds: [], warnings: [], skipped: [],
    },
    ...over,
  }
}

beforeEach(() => {
  dryRun.mutate.mockClear()
  dryRun.data = undefined
  dryRun.isError = false
  dryRun.isPending = false
})

describe('DryRunPanel', () => {
  it('says what a trial run would do before anyone presses it', () => {
    renderPage(<DryRunPanel structureId={1} structureName="Standard" />)
    expect(screen.getByText(/without changing anything/)).toBeInTheDocument()
  })

  it('runs against the chosen month', async () => {
    const user = userEvent.setup()
    renderPage(<DryRunPanel structureId={1} structureName="Standard" />)
    await user.click(screen.getByRole('button', { name: /Run/ }))
    expect(dryRun.mutate).toHaveBeenCalledWith({ period: expect.stringMatching(/^\d{4}-\d{2}$/) })
  })

  it('puts the current bill, the new bill and the difference on top', () => {
    dryRun.data = result()
    renderPage(<DryRunPanel structureId={1} structureName="Standard" />)
    expect(screen.getByText('Currently paid')).toBeInTheDocument()
    expect(screen.getByText('Would be paid')).toBeInTheDocument()
    expect(screen.getByText('Difference')).toBeInTheDocument()
    expect(screen.getByText('Across 1 people')).toBeInTheDocument()
  })

  // The requirement: a rule set that drives anyone below zero must be refused loudly, by name.
  it('names every person whose pay would go negative', () => {
    dryRun.data = result({
      results: [
        row(),
        row({ employeeId: 2, employeeName: 'Ben Okoro', employeeNo: 'EMP002', newNet: -1200, delta: -51200, negative: true }),
        row({ employeeId: 3, employeeName: 'Cara Diaz', employeeNo: 'EMP003', newNet: -300, delta: -50300, negative: true }),
      ],
      totals: {
        totalCurrentNet: 150000, totalNewNet: 46500, totalDelta: -103500,
        employeeCount: 3, negativeEmployeeIds: [2, 3], warnings: [], skipped: [],
      },
    })
    renderPage(<DryRunPanel structureId={1} structureName="Standard" />)
    expect(screen.getByText('2 people would be paid a negative amount')).toBeInTheDocument()
    expect(screen.getByText(/Ben Okoro, Cara Diaz/)).toBeInTheDocument()
    expect(screen.getByText(/cannot be used as it stands/)).toBeInTheDocument()
  })

  it('uses the singular when only one person is affected', () => {
    dryRun.data = result({
      results: [row({ newNet: -500, negative: true })],
      totals: {
        totalCurrentNet: 50000, totalNewNet: -500, totalDelta: -50500,
        employeeCount: 1, negativeEmployeeIds: [1], warnings: [], skipped: [],
      },
    })
    renderPage(<DryRunPanel structureId={1} structureName="Standard" />)
    expect(screen.getByText('1 person would be paid a negative amount')).toBeInTheDocument()
  })

  it('shows no banner when every simulated figure is payable', () => {
    dryRun.data = result()
    renderPage(<DryRunPanel structureId={1} structureName="Standard" />)
    expect(screen.queryByText(/negative amount/)).not.toBeInTheDocument()
  })

  it('says who was left out and why', () => {
    dryRun.data = result({
      totals: { ...result().totals, skipped: ['3 employees have no running contract for this month.'] },
    })
    renderPage(<DryRunPanel structureId={1} structureName="Standard" />)
    expect(screen.getByText('1 skipped')).toBeInTheDocument()
    expect(screen.getByText(/no running contract/)).toBeInTheDocument()
  })

  it('reports a failed run instead of leaving the panel blank', () => {
    dryRun.isError = true
    dryRun.error = new ApiError({ status: 400, code: 'VALIDATION', detail: 'Rule "OT" refers to a code that does not exist.' })
    renderPage(<DryRunPanel structureId={1} structureName="Standard" />)
    expect(screen.getByText('Could not run')).toBeInTheDocument()
    expect(screen.getByText(/does not exist/)).toBeInTheDocument()
  })

  it('explains that nobody matched rather than showing an empty table', () => {
    dryRun.data = result({
      results: [],
      totals: { totalCurrentNet: 0, totalNewNet: 0, totalDelta: 0, employeeCount: 0, negativeEmployeeIds: [], warnings: [], skipped: [] },
    })
    renderPage(<DryRunPanel structureId={1} structureName="Standard" />)
    expect(screen.getByText('Nobody to simulate')).toBeInTheDocument()
  })
})
