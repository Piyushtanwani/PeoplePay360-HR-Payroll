import * as React from 'react'
import { CalendarClock, Pencil, Plus, Trash2 } from 'lucide-react'
import { useDeleteSchedule, useSchedules } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import {
  ActiveBadge, Button, Card, Chip, ConfirmDialog, DataTable, HelpItems, HelpPopover, IconButton,
  PageHeader, Select, type Column,
} from '@/components/ui'
import { useSearchParamState } from '@/lib/hooks/useSearchParamState'
import { useTableState } from '@/lib/hooks/useTableState'
import { WEEKDAYS } from '@/api/constants'
import { ScheduleEditor } from './ScheduleEditor'
import type { WorkingSchedule } from '@/api/types'

export function SchedulesPage() {
  const { can } = useAuth()
  const [activeFilter, setActiveFilter] = useSearchParamState<string>('active', '')
  const table = useTableState({ defaultSort: 'name', defaultDir: 'asc' })
  const list = useSchedules({ ...table.params, active: activeFilter === '' ? undefined : activeFilter === 'true' })

  const [editing, setEditing] = React.useState<WorkingSchedule | null | 'new'>(null)
  const [deleting, setDeleting] = React.useState<WorkingSchedule | null>(null)
  const remove = useDeleteSchedule(() => setDeleting(null))

  const columns: Column<WorkingSchedule>[] = [
    { key: 'name', header: 'Schedule', sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    {
      key: 'days',
      header: 'Working days',
      render: (r) => (
        <span className="flex flex-wrap gap-1">
          {WEEKDAYS.map((day) => {
            const works = r.lines.some((l) => l.dayOfWeek === day.value)
            return (
              <Chip key={day.value} tone={works ? 'accent' : 'neutral'} className={works ? '' : 'opacity-50'}>
                {day.short}
              </Chip>
            )
          })}
        </span>
      ),
    },
    { key: 'type', header: 'Type', sortable: true, render: (r) => (r.type === 'FIXED' ? 'Fixed hours' : 'Flexible') },
    {
      key: 'weeklyHours',
      header: 'Hours a week',
      align: 'right',
      sortable: true,
      tooltip: 'Calculated by the server from the working days, less breaks.',
      render: (r) => r.weeklyHours,
    },
    { key: 'active', header: 'Status', sortable: true, render: (r) => <ActiveBadge active={r.active} labels={['Available', 'Archived']} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '92px',
      hidden: !can('schedule.update.all'),
      render: (r) => (
        <span className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <IconButton label={`Edit ${r.name}`} onClick={() => setEditing(r)}>
            <Pencil className="h-3.5 w-3.5" />
          </IconButton>
          {can('schedule.delete.all') ? (
            <IconButton label={`Delete ${r.name}`} onClick={() => setDeleting(r)}>
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          ) : null}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Working schedules"
        description="The weekly pattern behind attendance and payroll: which days are worked, and for how long."
        help={
          <HelpPopover title="What a schedule decides">
            <HelpItems
              items={[
                { term: 'Scheduled days', text: 'How many days a payroll period expects, which unpaid leave is deducted from.' },
                { term: 'Lateness and overtime', text: 'Measured against that day’s start and end times.' },
                { term: 'Absence', text: 'Only a scheduled working day can be an absence. Days off never are.' },
                { term: 'Hourly rate', text: 'Derived from the weekly hours for anyone not paid by the hour.' },
                { term: 'Weekly hours', text: 'Always calculated by the server from the rows, never typed in.' },
              ]}
            />
          </HelpPopover>
        }
        actions={
          can('schedule.create.all') ? (
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
              New schedule
            </Button>
          ) : undefined
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
          onRowClick={can('schedule.update.all') ? (r) => setEditing(r) : undefined}
          toolbar={{
            search: 'Search schedules',
            filters: (
              <Select
                value={activeFilter}
                onChange={setActiveFilter}
                className="w-44"
                options={[
                  { value: '', label: 'All schedules' },
                  { value: 'true', label: 'Available only' },
                  { value: 'false', label: 'Archived only' },
                ]}
              />
            ),
          }}
          empty={{
            icon: <CalendarClock className="h-6 w-6" />,
            title: 'No schedules yet',
            description: 'Without a schedule, a period expects no days, so attendance and payroll have nothing to measure against.',
            action: can('schedule.create.all') ? (
              <Button variant="primary" onClick={() => setEditing('new')}>Create the first schedule</Button>
            ) : undefined,
          }}
        />
      </Card>

      <ScheduleEditor
        open={editing !== null}
        schedule={editing === 'new' ? null : editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        sentence="This is refused while any employee or live contract still uses it. Archiving it instead keeps those people working."
        confirmLabel="Delete schedule"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  )
}
