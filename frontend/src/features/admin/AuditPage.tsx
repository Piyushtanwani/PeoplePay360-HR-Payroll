import * as React from 'react'
import { Link } from 'react-router-dom'
import { Download, ScrollText } from 'lucide-react'
import { useAuditEvents, useAuditSummary, useUserOptions } from '@/api/hooks'
import { AUDIT_CHANNELS, CHANNEL_DESCRIPTIONS, RESOURCE_LINKS } from '@/api/constants'
import { useAuth } from '@/auth/AuthProvider'
import {
  Button, Card, Chip, DataTable, DateRangePicker, DetailList, HelpItems, HelpPopover, KpiCard,
  PageHeader, Select, Sheet, StatusBadge, Tooltip, type Column,
} from '@/components/ui'
import { useDownload } from '@/lib/download'
import { daysAgo, todayIso } from '@/lib/dates'
import { fmtDateTime, labelize, num } from '@/lib/format'
import { useNumberParamState, useSearchParamState } from '@/lib/hooks/useSearchParamState'
import { useTableState } from '@/lib/hooks/useTableState'
import type { AuditEvent } from '@/api/types'

const RESOURCE_TYPES = [
  { value: '', label: 'Anything' },
  { value: 'employee', label: 'Employees' },
  { value: 'contract', label: 'Contracts' },
  { value: 'payrun', label: 'Payruns' },
  { value: 'payslip', label: 'Payslips' },
  { value: 'salary_structure', label: 'Salary structures' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'timeoff_request', label: 'Leave requests' },
  { value: 'timeoff_allocation', label: 'Leave allocations' },
  { value: 'user', label: 'Users' },
  { value: 'public_holiday', label: 'Holidays' },
]

/**
 * The audit log answers three questions: who changed a figure, who was refused something they tried
 * to do, and what a record looked like before somebody edited it.
 *
 * It opens on the last week rather than the whole history, because an unbounded list of everything
 * that has ever happened answers none of those.
 */
export function AuditPage() {
  const { can } = useAuth()
  const users = useUserOptions()
  const { download, pending: downloading } = useDownload()

  const [from, setFrom] = useSearchParamState<string>('from', daysAgo(7))
  const [to, setTo] = useSearchParamState<string>('to', todayIso())
  const [channel, setChannel] = useSearchParamState<string>('channel', '')
  const [outcome, setOutcome] = useSearchParamState<string>('outcome', '')
  const [resourceType, setResourceType] = useSearchParamState<string>('resourceType', '')
  const [actorUserId, setActorUserId] = useNumberParamState('actorUserId')
  const [open, setOpen] = React.useState<AuditEvent | null>(null)

  const table = useTableState({ defaultSort: 'occurredAt', defaultDir: 'desc' })
  const filters = {
    // The server compares instants, so a day is sent as its full span.
    from: `${from}T00:00:00Z`,
    to: `${to}T23:59:59Z`,
    channel: channel || undefined,
    outcome: outcome || undefined,
    resourceType: resourceType || undefined,
    actorUserId,
  }
  const list = useAuditEvents({ ...table.params, ...filters })
  const summary = useAuditSummary({ ...filters, outcome: undefined })

  const columns: Column<AuditEvent>[] = [
    { key: 'occurredAt', header: 'When', sortable: true, render: (r) => fmtDateTime(r.occurredAt) },
    {
      key: 'actorName',
      header: 'Who',
      sortable: true,
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.actorName ?? 'System'}</p>
          <p className="truncate text-xs2 text-label2">{(r.actorRoles ?? []).join(', ') || '—'}</p>
        </div>
      ),
    },
    {
      key: 'channel',
      header: 'Through',
      sortable: true,
      render: (r) => (
        <Tooltip content={CHANNEL_DESCRIPTIONS[r.channel] ?? r.channel}>
          <span><Chip>{r.channel}</Chip></span>
        </Tooltip>
      ),
    },
    { key: 'action', header: 'Did what', sortable: true, render: (r) => labelize(r.action) },
    {
      key: 'resourceType',
      header: 'To',
      sortable: true,
      render: (r) => {
        if (!r.resourceType) return '—'
        const href = r.resourceId ? RESOURCE_LINKS[r.resourceType]?.(r.resourceId) : undefined
        const label = `${labelize(r.resourceType)}${r.resourceId ? ` ${r.resourceId}` : ''}`
        return href ? (
          <Link to={href} onClick={(e) => e.stopPropagation()} className="text-accent hover:underline">
            {label}
          </Link>
        ) : (
          label
        )
      },
    },
    { key: 'outcome', header: 'Outcome', sortable: true, render: (r) => <StatusBadge status={r.outcome} /> },
  ]

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Who changed what, who was refused, and what a record looked like beforehand."
        help={
          <HelpPopover title="What this is for" size="lg">
            <HelpItems
              items={[
                { term: 'Explaining a figure', text: 'Find who last changed a wage, a bank account or a payrun, and the reason they gave.' },
                { term: 'Investigating a refusal', text: 'Filter to denials to see what someone tried to do and which permission stopped them.' },
                { term: 'Before and after', text: 'Sensitive changes record both, so what a record used to say is recoverable.' },
                { term: 'Request id', text: 'Every failure the app shows carries one. Search it here to find the exact event.' },
              ]}
            />
            <div className="border-t border-separator pt-3">
              <p className="mb-2 font-medium text-label">Channels</p>
              <HelpItems items={Object.entries(CHANNEL_DESCRIPTIONS).map(([key, text]) => ({ term: key, text }))} />
            </div>
          </HelpPopover>
        }
        actions={
          can('audit.export') ? (
            <Button
              icon={<Download className="h-4 w-4" />}
              loading={downloading}
              onClick={() => download('/api/admin/audit/export.csv', 'audit.csv', filters)}
            >
              Export what is on screen
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Events in this range"
          value={num(summary.data?.events)}
          loading={summary.isLoading}
          hint="Matching the filters below"
        />
        <KpiCard
          label="Refused"
          value={num(summary.data?.denied)}
          tone={(summary.data?.denied ?? 0) > 0 ? 'warn' : 'neutral'}
          loading={summary.isLoading}
          hint="Actions somebody attempted without permission"
        />
        <KpiCard
          label="Showing"
          value={num(list.data?.totalElements)}
          loading={list.isLoading}
          hint="After the outcome and resource filters"
        />
      </div>

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
          onRowClick={(r) => setOpen(r)}
          dense
          toolbar={{
            search: 'Search reason, action or person',
            filters: (
              <>
                <DateRangePicker from={from} to={to} onChange={({ from: f, to: t }) => { setFrom(f); setTo(t) }} />
                <Select value={channel} onChange={setChannel} options={AUDIT_CHANNELS} className="w-48" />
                <Select
                  value={outcome}
                  onChange={setOutcome}
                  className="w-40"
                  options={[
                    { value: '', label: 'Any outcome' },
                    { value: 'ALLOW', label: 'Allowed' },
                    { value: 'DENY', label: 'Refused' },
                  ]}
                />
                <Select value={resourceType} onChange={setResourceType} options={RESOURCE_TYPES} className="w-48" />
                <Select
                  value={actorUserId}
                  onChange={setActorUserId}
                  clearable
                  onClear={() => setActorUserId(null)}
                  placeholder="Anyone"
                  className="w-52"
                  options={(users.data?.content ?? []).map((u) => ({ value: u.id, label: u.displayName, description: u.email }))}
                />
              </>
            ),
          }}
          empty={{
            icon: <ScrollText className="h-6 w-6" />,
            title: 'Nothing in this range',
            description: 'Widen the dates or clear the filters. Every change and every refusal is recorded here.',
          }}
        />
      </Card>

      <AuditDetailSheet event={open} onOpenChange={(isOpen) => !isOpen && setOpen(null)} />
    </>
  )
}

function AuditDetailSheet({ event, onOpenChange }: { event: AuditEvent | null; onOpenChange: (open: boolean) => void }) {
  const href = event?.resourceType && event.resourceId ? RESOURCE_LINKS[event.resourceType]?.(event.resourceId) : undefined

  return (
    <Sheet
      open={event !== null}
      onOpenChange={onOpenChange}
      width="lg"
      title={event ? labelize(event.action) : 'Audit event'}
      description="What happened, who did it, and what the record looked like before and after."
      footer={
        <>
          {href ? (
            <Link to={href}>
              <Button>Open the record</Button>
            </Link>
          ) : null}
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </>
      }
    >
      {event ? (
        <div className="space-y-4">
          <DetailList
            items={[
              { label: 'When', value: fmtDateTime(event.occurredAt) },
              { label: 'Who', value: event.actorName ?? 'System' },
              { label: 'Their roles', value: (event.actorRoles ?? []).join(', ') || '—' },
              { label: 'Through', value: event.channel, hint: CHANNEL_DESCRIPTIONS[event.channel] },
              { label: 'Action', value: labelize(event.action) },
              {
                label: 'Record',
                value: href ? (
                  <Link to={href} className="text-accent hover:underline">
                    {labelize(event.resourceType)} {event.resourceId}
                  </Link>
                ) : (
                  `${labelize(event.resourceType)} ${event.resourceId ?? ''}`.trim() || '—'
                ),
              },
              { label: 'Outcome', value: <StatusBadge status={event.outcome} /> },
              { label: 'Reason given', value: event.reason || '—' },
              { label: 'Request id', value: <span className="tnum text-xs2">{event.requestId ?? '—'}</span> },
            ]}
          />
          <JsonDiff before={event.beforeJson} after={event.afterJson} />
        </div>
      ) : null}
    </Sheet>
  )
}

/**
 * What changed, field by field.
 *
 * Two blocks of raw JSON side by side make the reader do the diffing. This lines the fields up and
 * highlights only the ones that actually moved.
 */
function JsonDiff({ before, after }: { before: string | null; after: string | null }) {
  const parsed = React.useMemo(() => {
    const parse = (value: string | null) => {
      if (!value) return null
      try {
        const result = JSON.parse(value)
        return result && typeof result === 'object' && !Array.isArray(result) ? (result as Record<string, unknown>) : null
      } catch {
        return null
      }
    }
    return { before: parse(before), after: parse(after) }
  }, [before, after])

  if (!before && !after) {
    return (
      <p className="text-sm2 text-label2">
        This action did not change a record, so there is nothing to compare.
      </p>
    )
  }

  if (!parsed.before && !parsed.after) {
    return (
      <div className="space-y-2">
        <p className="text-sm2 font-semibold">Recorded values</p>
        <pre className="overflow-x-auto rounded-card border border-separator bg-surface2/60 p-3 text-xs2">
          {after ?? before}
        </pre>
      </div>
    )
  }

  const fields = Array.from(new Set([...Object.keys(parsed.before ?? {}), ...Object.keys(parsed.after ?? {})])).sort()
  const show = (value: unknown) =>
    value === null || value === undefined ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value)

  return (
    <div>
      <p className="mb-2 text-sm2 font-semibold">What changed</p>
      <div className="overflow-hidden rounded-card border border-separator">
        <table className="w-full text-sm2">
          <thead>
            <tr className="border-b border-separator bg-surface2/60 text-left text-xs2 uppercase tracking-wide text-label2">
              <th className="px-3 py-2">Field</th>
              <th className="px-3 py-2">Before</th>
              <th className="px-3 py-2">After</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => {
              const wasValue = show(parsed.before?.[field])
              const nowValue = show(parsed.after?.[field])
              const changed = wasValue !== nowValue
              return (
                <tr key={field} className={changed ? 'border-b border-separator/60 bg-warn/8' : 'border-b border-separator/60'}>
                  <td className="px-3 py-1.5 font-medium">{field}</td>
                  <td className="px-3 py-1.5 text-label2">{wasValue}</td>
                  <td className={changed ? 'px-3 py-1.5 font-medium' : 'px-3 py-1.5 text-label2'}>{nowValue}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs2 text-label2">Highlighted rows are the fields that changed.</p>
    </div>
  )
}
