import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import {
  Button, Card, CardHeader, Chip, DataTable, Field, PageHeader, Select, Sheet, StatusBadge, TextInput,
  TimeField, Toggle, useToast,
} from '@/components/ui'
import type { Page, ScheduleLine, WorkingSchedule } from '@/api/types'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const BREAKS = [0, 15, 30, 45, 60].map((m) => ({ value: m, label: m === 0 ? 'No break' : `${m} minutes` }))

function lineHours(line: ScheduleLine) {
  const [sh, sm] = line.startTime.split(':').map(Number)
  const [eh, em] = line.endTime.split(':').map(Number)
  return Math.max(0, eh * 60 + em - (sh * 60 + sm) - line.breakMinutes) / 60
}

export function SchedulesPage() {
  const { can } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [selected, setSelected] = React.useState<WorkingSchedule | 'new' | null>(null)

  const query = useQuery({ queryKey: ['schedules'], queryFn: () => api.get<Page<WorkingSchedule>>('/api/schedules', { size: 100 }) })

  const save = useMutation({
    mutationFn: (schedule: WorkingSchedule) =>
      schedule.id
        ? api.put<WorkingSchedule>(`/api/schedules/${schedule.id}`, schedule)
        : api.post<WorkingSchedule>('/api/schedules', schedule),
    onSuccess: (schedule) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      setSelected(null)
      toast.push({ tone: 'success', title: 'Schedule saved', detail: `${schedule.name} · ${schedule.weeklyHours}h per week` })
    },
    onError: (error) => toast.push({ tone: 'error', title: 'Could not save schedule', detail: error instanceof ApiError ? error.detail : '' }),
  })

  return (
    <>
      <PageHeader
        title="Working schedules"
        description="A schedule defines the weekly working pattern. Attendance and payroll use it as the expected working time."
        actions={can('schedule.create.all') ? <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setSelected('new')}>New schedule</Button> : undefined}
      />

      <Card>
        <DataTable
          rows={query.data?.content ?? []}
          loading={query.isLoading}
          onRowClick={(row) => setSelected(row)}
          columns={[
            { key: 'name', header: 'Schedule name', render: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
            { key: 'type', header: 'Calendar type', render: (r) => <Chip>{r.type.toLowerCase()}</Chip> },
            { key: 'days', header: 'Days / week', align: 'right', render: (r) => r.lines.length },
            { key: 'hours', header: 'Hours / week', align: 'right', render: (r) => `${r.weeklyHours}h`, sortValue: (r) => r.weeklyHours },
            { key: 'company', header: 'Company', render: (r) => r.companyName },
            { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.active ? 'ACTIVE' : 'CANCELLED'} /> },
          ]}
        />
      </Card>

      {selected ? (
        <ScheduleEditor
          initial={selected === 'new' ? null : selected}
          readOnly={!can('schedule.update.all')}
          saving={save.isPending}
          onClose={() => setSelected(null)}
          onSave={(schedule) => save.mutate(schedule)}
        />
      ) : null}
    </>
  )
}

function ScheduleEditor({ initial, onClose, onSave, saving, readOnly }: {
  initial: WorkingSchedule | null
  onClose: () => void
  onSave: (schedule: WorkingSchedule) => void
  saving: boolean
  readOnly: boolean
}) {
  const [schedule, setSchedule] = React.useState<WorkingSchedule>(
    initial ?? {
      id: 0, name: '', type: 'FIXED', weeklyHours: 0, active: true, companyName: 'OXP Pvt Ltd',
      lines: [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startTime: '09:00', endTime: '17:30', breakMinutes: 60 })),
    },
  )

  const previewHours = React.useMemo(
    () => Math.round(schedule.lines.reduce((sum, line) => sum + lineHours(line), 0) * 100) / 100,
    [schedule.lines],
  )

  const updateLine = (index: number, patch: Partial<ScheduleLine>) =>
    setSchedule((s) => ({ ...s, lines: s.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)) }))

  const addDay = () => {
    const used = new Set(schedule.lines.map((l) => l.dayOfWeek))
    const next = [1, 2, 3, 4, 5, 6, 7].find((d) => !used.has(d)) ?? 1
    setSchedule((s) => ({ ...s, lines: [...s.lines, { dayOfWeek: next, startTime: '09:00', endTime: '17:30', breakMinutes: 60 }] }))
  }

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && onClose()}
      width="lg"
      title={initial ? initial.name : 'New working schedule'}
      description="The weekly pattern below determines total weekly hours."
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          {!readOnly ? <Button variant="primary" loading={saving} disabled={!schedule.name.trim()} onClick={() => onSave(schedule)}>Save schedule</Button> : null}
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Schedule name" required><TextInput value={schedule.name} disabled={readOnly} onChange={(e) => setSchedule((s) => ({ ...s, name: e.target.value }))} placeholder="Standard 37.5h" /></Field>
          <Field label="Calendar type">
            <Select value={schedule.type} onChange={(v) => setSchedule((s) => ({ ...s, type: v }))} disabled={readOnly}
              options={[{ value: 'FIXED', label: 'Fixed hours' }, { value: 'FLEXIBLE', label: 'Flexible hours' }]} />
          </Field>
        </div>

        <div className="flex items-center justify-between rounded-control bg-surface2 px-4 py-2.5">
          <span className="text-sm2 text-label2">Active</span>
          <Toggle checked={schedule.active} disabled={readOnly} onChange={(v) => setSchedule((s) => ({ ...s, active: v }))} label="Active" />
        </div>

        <Card>
          <CardHeader
            title="Weekly schedule"
            action={!readOnly ? <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={addDay}>Add day</Button> : undefined}
          />
          <div className="divide-y divide-separator">
            {schedule.lines.map((line, index) => (
              <div key={index} className="grid grid-cols-[1.2fr_1fr_1fr_1fr_auto_auto] items-center gap-2 px-4 py-2.5">
                <Select
                  value={line.dayOfWeek}
                  disabled={readOnly}
                  onChange={(v) => updateLine(index, { dayOfWeek: v })}
                  options={DAYS.map((label, i) => ({ value: i + 1, label }))}
                />
                <TimeField value={line.startTime} disabled={readOnly} onChange={(v) => updateLine(index, { startTime: v })} />
                <TimeField value={line.endTime} disabled={readOnly} onChange={(v) => updateLine(index, { endTime: v })} />
                <Select value={line.breakMinutes} disabled={readOnly} onChange={(v) => updateLine(index, { breakMinutes: v })} options={BREAKS} />
                <span className="tnum w-12 text-right text-sm2 text-label2">{lineHours(line).toFixed(1)}h</span>
                {!readOnly ? (
                  <button aria-label="Remove day" className="text-label2 hover:text-bad"
                    onClick={() => setSchedule((s) => ({ ...s, lines: s.lines.filter((_, i) => i !== index) }))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : <span />}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-separator px-4 py-3">
            <span className="text-sm2 text-label2">Total weekly hours</span>
            <span className="tnum text-[17px] font-semibold">{previewHours}h</span>
          </div>
        </Card>

        <p className="text-xs2 text-label2">
          Weekly hours are derived from the pattern above and confirmed by the server on save. Assign this schedule to an
          employee or contract to drive attendance and payroll expectations.
        </p>
      </div>
    </Sheet>
  )
}
