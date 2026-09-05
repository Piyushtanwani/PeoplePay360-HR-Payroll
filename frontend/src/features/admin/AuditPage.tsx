import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { api, buildUrl } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import { Button, Card, DataTable, PageHeader, SegmentedControl, Select, Sheet, StatusBadge, TextInput } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'
import type { AdminUser, AuditEvent, Page } from '@/api/types'

const RESOURCES = ['Employee', 'Payrun', 'Payslip', 'TimeOffRequest', 'Attendance', 'AppUser'].map((r) => ({ value: r, label: r }))

export function AuditPage() {
  const { can, token } = useAuth()
  const [channel, setChannel] = React.useState<string | null>(null)
  const [outcome, setOutcome] = React.useState<string | null>(null)
  const [resourceType, setResourceType] = React.useState<string | null>(null)
  const [actorUserId, setActorUserId] = React.useState<number | null>(null)
  const [q, setQ] = React.useState('')
  const [open, setOpen] = React.useState<AuditEvent | null>(null)

  const users = useQuery({ queryKey: ['admin', 'users', 'all'], queryFn: () => api.get<Page<AdminUser>>('/api/admin/users', { size: 100 }) })
  const query = useQuery({
    queryKey: ['admin', 'audit', channel, outcome, resourceType, actorUserId, q],
    queryFn: () => api.get<Page<AuditEvent>>('/api/admin/audit', { channel, outcome, resourceType, actorUserId, q, size: 200 }),
  })

  const exportCsv = async () => {
    const response = await fetch(buildUrl('/api/admin/audit/export.csv'), { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'audit.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every permission decision, sensitive read and payroll action is recorded."
        actions={can('audit.export') ? <Button icon={<Download className="h-4 w-4" />} onClick={exportCsv}>Export CSV</Button> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SegmentedControl
          value={channel ?? 'ALL'}
          onChange={(value) => setChannel(value === 'ALL' ? null : value)}
          options={[{ value: 'ALL', label: 'All' }, { value: 'UI', label: 'UI' }, { value: 'MCP', label: 'MCP' }, { value: 'CHAT', label: 'Chat' }, { value: 'SYSTEM', label: 'System' }]}
        />
        <Select className="w-44" value={outcome} onChange={setOutcome} clearable onClear={() => setOutcome(null)} placeholder="Any outcome"
          options={[{ value: 'ALLOW', label: 'Allow' }, { value: 'DENY', label: 'Deny' }]} />
        <Select className="w-52" value={resourceType} onChange={setResourceType} clearable onClear={() => setResourceType(null)} placeholder="Any resource" options={RESOURCES} />
        <Select className="w-56" value={actorUserId} onChange={setActorUserId} clearable onClear={() => setActorUserId(null)} placeholder="Any actor"
          options={(users.data?.content ?? []).map((u) => ({ value: u.id, label: u.displayName, description: u.roleCode.toLowerCase() }))} />
        <TextInput className="w-56" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actions…" />
      </div>

      <Card>
        <DataTable
          rows={query.data?.content ?? []}
          loading={query.isLoading}
          dense
          onRowClick={setOpen}
          columns={[
            { key: 'when', header: 'When', render: (r) => <span className="tnum text-label2">{fmtDateTime(r.occurredAt)}</span>, sortValue: (r) => r.occurredAt },
            { key: 'actor', header: 'Actor', render: (r) => r.actorName },
            { key: 'channel', header: 'Channel', render: (r) => r.channel },
            { key: 'action', header: 'Action', render: (r) => <span className="font-medium">{r.action.replace(/_/g, ' ').toLowerCase()}</span> },
            { key: 'resource', header: 'Resource', render: (r) => `${r.resourceType} #${r.resourceId}` },
            { key: 'outcome', header: 'Outcome', render: (r) => <StatusBadge status={r.outcome} /> },
          ]}
        />
      </Card>

      {open ? (
        <Sheet open onOpenChange={(next) => !next && setOpen(null)} title={open.action.replace(/_/g, ' ').toLowerCase()} description={fmtDateTime(open.occurredAt)}
          footer={<Button onClick={() => setOpen(null)}>Close</Button>}>
          <dl className="divide-y divide-separator rounded-card border border-separator">
            {[
              ['Actor', `${open.actorName} (${open.actorRoles})`], ['Channel', open.channel],
              ['Resource', `${open.resourceType} #${open.resourceId}`], ['Reason', open.reason ?? '—'],
              ['Request id', open.requestId],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-4 py-2.5 text-sm2">
                <dt className="text-label2">{label}</dt><dd className="tnum text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          {open.beforeJson || open.afterJson ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div><p className="mb-1 text-xs2 font-semibold uppercase text-label2">Before</p><pre className="overflow-x-auto rounded-control bg-surface2 p-3 text-xs2">{open.beforeJson ?? '—'}</pre></div>
              <div><p className="mb-1 text-xs2 font-semibold uppercase text-label2">After</p><pre className="overflow-x-auto rounded-control bg-surface2 p-3 text-xs2">{open.afterJson ?? '—'}</pre></div>
            </div>
          ) : null}
        </Sheet>
      ) : null}
    </>
  )
}
