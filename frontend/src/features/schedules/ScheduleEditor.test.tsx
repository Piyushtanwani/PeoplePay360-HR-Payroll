import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderPage } from '@/test/render'

const save = { mutate: vi.fn(), isPending: false }
vi.mock('@/api/hooks', () => ({ useSaveSchedule: () => save }))

import { ScheduleEditor } from './ScheduleEditor'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

beforeEach(() => save.mutate.mockClear())

describe('ScheduleEditor', () => {
  it('shows all seven days at once, with no button to add one', () => {
    renderPage(<ScheduleEditor open onOpenChange={() => {}} />)
    for (const day of DAYS) expect(screen.getByText(day)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add day/i })).not.toBeInTheDocument()
  })

  it('labels every column, so no time field has to be guessed at', () => {
    renderPage(<ScheduleEditor open onOpenChange={() => {}} />)
    for (const heading of ['Day', 'Working', 'Start time', 'End time', 'Break', 'Hours']) {
      expect(screen.getByText(heading)).toBeInTheDocument()
    }
  })

  it('starts a new schedule with the working week on and the weekend off', () => {
    renderPage(<ScheduleEditor open onOpenChange={() => {}} />)
    expect(screen.getByRole('switch', { name: 'Monday is a working day' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Saturday is a working day' })).not.toBeChecked()
    expect(screen.getByRole('switch', { name: 'Sunday is a working day' })).not.toBeChecked()
  })

  it('disables the time fields on a day nobody works', () => {
    renderPage(<ScheduleEditor open onOpenChange={() => {}} />)
    expect(screen.getByLabelText('Sunday start time')).toBeDisabled()
    expect(screen.getByLabelText('Sunday end time')).toBeDisabled()
  })

  it('enables a day when its switch is turned on', async () => {
    const user = userEvent.setup()
    renderPage(<ScheduleEditor open onOpenChange={() => {}} />)
    expect(screen.getByLabelText('Saturday start time')).toBeDisabled()
    await user.click(screen.getByRole('switch', { name: 'Saturday is a working day' }))
    expect(screen.getByLabelText('Saturday start time')).toBeEnabled()
    expect(screen.getByLabelText('Saturday end time')).toBeEnabled()
  })

  it('sends only the working days, because a day that is off has no hours to store', async () => {
    const user = userEvent.setup()
    renderPage(<ScheduleEditor open onOpenChange={() => {}} />)
    await user.type(screen.getByLabelText(/Schedule name/), 'Standard week')
    await user.click(screen.getByRole('button', { name: /Create schedule/ }))

    expect(save.mutate).toHaveBeenCalledTimes(1)
    const sent = save.mutate.mock.calls[0][0]
    expect(sent.body.lines).toHaveLength(5)
    expect(sent.body.lines.map((l: { dayOfWeek: number }) => l.dayOfWeek)).toEqual([1, 2, 3, 4, 5])
    expect(sent.body.name).toBe('Standard week')
  })

  it('refuses to save a schedule with no name', () => {
    renderPage(<ScheduleEditor open onOpenChange={() => {}} />)
    expect(screen.getByRole('button', { name: /Create schedule/ })).toBeDisabled()
  })

  it('refuses to save when every day is switched off', async () => {
    const user = userEvent.setup()
    renderPage(<ScheduleEditor open onOpenChange={() => {}} />)
    await user.type(screen.getByLabelText(/Schedule name/), 'Empty week')
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      await user.click(screen.getByRole('switch', { name: `${day} is a working day` }))
    }
    expect(screen.getByRole('button', { name: /Create schedule/ })).toBeDisabled()
  })

  it('loads an existing schedule with only its stored days switched on', () => {
    renderPage(
      <ScheduleEditor
        open
        onOpenChange={() => {}}
        schedule={{
          id: 1, name: 'Four-day week', type: 'FIXED', active: true, weeklyHours: 30,
          lines: [1, 2, 3, 4].map((dayOfWeek) => ({
            id: dayOfWeek, dayOfWeek, startTime: '09:00:00', endTime: '17:00:00', breakMinutes: 30,
          })),
        } as never}
      />,
    )
    expect(screen.getByRole('switch', { name: 'Thursday is a working day' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Friday is a working day' })).not.toBeChecked()
  })
})
