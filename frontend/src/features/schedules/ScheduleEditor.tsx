import * as React from 'react'
import { useSaveSchedule } from '@/api/hooks'
import { BREAK_OPTIONS, WEEKDAYS } from '@/api/constants'
import { Button, Callout, Field, Select, Sheet, TextInput, TimeField, Toggle } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { ScheduleLine, WorkingSchedule } from '@/api/types'

interface WeekRow {
  dayOfWeek: number
  active: boolean
  startTime: string
  endTime: string
  breakMinutes: number
}

const DEFAULT_START = '09:00'
const DEFAULT_END = '17:00'
const DEFAULT_BREAK = 30

/** All seven days, every time. Days without a line are simply switched off. */
function toRows(lines: ScheduleLine[] | undefined): WeekRow[] {
  return WEEKDAYS.map((day) => {
    const line = lines?.find((l) => l.dayOfWeek === day.value)
    return {
      dayOfWeek: day.value,
      active: Boolean(line),
      startTime: line?.startTime?.slice(0, 5) ?? DEFAULT_START,
      endTime: line?.endTime?.slice(0, 5) ?? DEFAULT_END,
      breakMinutes: line?.breakMinutes ?? DEFAULT_BREAK,
    }
  })
}

/** Weekday defaults for a brand-new schedule: Monday to Friday on, the weekend off. */
function defaultRows(): WeekRow[] {
  return WEEKDAYS.map((day) => ({
    dayOfWeek: day.value,
    active: day.value <= 5,
    startTime: DEFAULT_START,
    endTime: DEFAULT_END,
    breakMinutes: DEFAULT_BREAK,
  }))
}

function hoursFor(row: WeekRow): number {
  if (!row.active) return 0
  const [sh, sm] = row.startTime.split(':').map(Number)
  const [eh, em] = row.endTime.split(':').map(Number)
  const minutes = eh * 60 + em - (sh * 60 + sm) - row.breakMinutes
  return minutes > 0 ? minutes / 60 : 0
}

/**
 * The weekly pattern.
 *
 * Every day is always on screen with a switch, rather than being added one at a time from a button.
 * A row nobody works is a fact worth showing: it is what stops that day counting as absence, and it is
 * how someone checks the weekend really is off.
 */
export function ScheduleEditor({ open, onOpenChange, schedule, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule?: WorkingSchedule | null
  onSaved?: () => void
}) {
  const editing = Boolean(schedule)
  const save = useSaveSchedule(() => { onOpenChange(false); onSaved?.() })

  const [name, setName] = React.useState('')
  const [type, setType] = React.useState('FIXED')
  const [active, setActive] = React.useState(true)
  const [rows, setRows] = React.useState<WeekRow[]>(defaultRows)

  React.useEffect(() => {
    if (!open) return
    setName(schedule?.name ?? '')
    setType(schedule?.type ?? 'FIXED')
    setActive(schedule?.active ?? true)
    setRows(schedule ? toRows(schedule.lines) : defaultRows())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schedule?.id])

  const setRow = (dayOfWeek: number, patch: Partial<WeekRow>) =>
    setRows((current) => current.map((row) => (row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row)))

  const activeRows = rows.filter((r) => r.active)
  const invalidRow = activeRows.find((r) => hoursFor(r) <= 0)
  const weeklyHours = rows.reduce((total, row) => total + hoursFor(row), 0)
  const valid = name.trim().length > 0 && activeRows.length > 0 && !invalidRow

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      title={editing ? `Edit ${schedule?.name}` : 'New working schedule'}
      description="Decides how many days and hours a payroll period expects, and which days can count as an absence."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!valid}
            onClick={() =>
              save.mutate({
                id: schedule?.id ?? null,
                body: {
                  name: name.trim(),
                  type,
                  active,
                  lines: activeRows.map((row) => ({
                    dayOfWeek: row.dayOfWeek,
                    startTime: row.startTime,
                    endTime: row.endTime,
                    breakMinutes: row.breakMinutes,
                  })),
                },
              })
            }
          >
            {editing ? 'Save schedule' : 'Create schedule'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Schedule name" required htmlFor="sched-name">
            <TextInput
              id="sched-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Standard 37.5 hours"
            />
          </Field>
          <Field label="Calendar type" hint="Fixed hours are checked against attendance; flexible ones are not.">
            <Select
              value={type}
              onChange={setType}
              options={[
                { value: 'FIXED', label: 'Fixed hours' },
                { value: 'FLEXIBLE', label: 'Flexible hours' },
              ]}
            />
          </Field>
        </div>

        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm2 font-semibold">Working week</h3>
            <p className="text-xs2 text-label2">Switch a day off and it is neither expected nor counted as absence.</p>
          </div>

          <div className="overflow-hidden rounded-card border border-separator">
            {/* A header row, so nobody has to guess which time field is which. */}
            <div className="grid grid-cols-[104px_64px_1fr_1fr_112px_72px] items-center gap-3 border-b border-separator bg-surface2/60 px-3 py-2 text-xs2 font-semibold uppercase tracking-wide text-label2">
              <span>Day</span>
              <span>Working</span>
              <span>Start time</span>
              <span>End time</span>
              <span>Break</span>
              <span className="text-right">Hours</span>
            </div>

            {rows.map((row) => {
              const day = WEEKDAYS.find((d) => d.value === row.dayOfWeek)!
              const hours = hoursFor(row)
              const broken = row.active && hours <= 0
              return (
                <div
                  key={row.dayOfWeek}
                  className={cn(
                    'grid grid-cols-[104px_64px_1fr_1fr_112px_72px] items-center gap-3 border-b border-separator/60 px-3 py-2 last:border-0',
                    !row.active && 'bg-surface2/40',
                  )}
                >
                  <span className={cn('text-sm2 font-medium', !row.active && 'text-label2')}>{day.label}</span>
                  <Toggle
                    checked={row.active}
                    onChange={(v) => setRow(row.dayOfWeek, { active: v })}
                    label={`${day.label} is a working day`}
                  />
                  <div className={cn(!row.active && 'pointer-events-none opacity-40')}>
                    <TimeField
                      label={`${day.label} start time`}
                      value={row.startTime}
                      disabled={!row.active}
                      onChange={(v) => setRow(row.dayOfWeek, { startTime: v })}
                    />
                  </div>
                  <div className={cn(!row.active && 'pointer-events-none opacity-40')}>
                    <TimeField
                      label={`${day.label} end time`}
                      value={row.endTime}
                      disabled={!row.active}
                      onChange={(v) => setRow(row.dayOfWeek, { endTime: v })}
                    />
                  </div>
                  <div className={cn(!row.active && 'pointer-events-none opacity-40')}>
                    <Select
                      value={String(row.breakMinutes)}
                      onChange={(v) => setRow(row.dayOfWeek, { breakMinutes: Number(v) })}
                      options={BREAK_OPTIONS}
                      disabled={!row.active}
                    />
                  </div>
                  <span
                    className={cn(
                      'tnum text-right text-sm2',
                      broken ? 'font-medium text-bad' : row.active ? 'text-label' : 'text-label2',
                    )}
                  >
                    {row.active ? `${hours.toFixed(2)}h` : '—'}
                  </span>
                </div>
              )
            })}

            <div className="flex items-center justify-between bg-surface2/60 px-3 py-2.5">
              <span className="text-sm2 font-semibold">Weekly total</span>
              <span className="tnum text-sm2 font-semibold">{weeklyHours.toFixed(2)} hours</span>
            </div>
          </div>

          {invalidRow ? (
            <Callout tone="bad" title="Check the times">
              {WEEKDAYS.find((d) => d.value === invalidRow.dayOfWeek)?.label} ends before it starts, or the break is
              longer than the day.
            </Callout>
          ) : activeRows.length === 0 ? (
            <Callout tone="warn" title="No working days">
              A schedule needs at least one working day, otherwise every period expects zero days.
            </Callout>
          ) : null}
        </section>

        <div className="flex items-center justify-between rounded-card border border-separator px-4 py-3">
          <div>
            <p className="text-sm2 font-medium">Available</p>
            <p className="text-xs2 text-label2">
              Archived schedules stay on the people already using them, but are no longer offered.
            </p>
          </div>
          <Toggle checked={active} onChange={setActive} label="Available" />
        </div>

        <p className="text-xs2 text-label2">
          The server recalculates the weekly hours from these rows when you save, so the figure above is a preview.
        </p>
      </div>
    </Sheet>
  )
}
