import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, ShieldCheck, UserPlus } from 'lucide-react'
import {
  useAdminUsers, useAssignRole, useAuditEvents, useCreateGrant, usePermissionCatalogue, useResendInvite,
  useRevokeGrant, useUpdateUser, useUserPermissions,
} from '@/api/hooks'
import { ROLE_OPTIONS } from '@/api/constants'
import { useAuth } from '@/auth/AuthProvider'
import {
  ActiveBadge, Button, Callout, Card, Chip, ConfirmDialog, DataTable, DetailList, Field, HelpItems,
  HelpPopover, PageHeader, SegmentedControl, Select, Sheet, StatusBadge, TabPanel, Tabs, TextArea,
  TextInput, Toggle, Tooltip, type Column,
} from '@/components/ui'
import { fmtDateTime } from '@/lib/format'
import { useNumberParamState, useSearchParamState } from '@/lib/hooks/useSearchParamState'
import { useTableState } from '@/lib/hooks/useTableState'
import type { AdminUser, RoleCode } from '@/api/types'

const EXPIRY_OPTIONS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'never', label: 'No expiry' },
]

function expiryToIso(choice: string): string | null {
  if (choice === 'never') return null
  const days = Number(choice.replace('d', ''))
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

/**
 * Logins and what they may do.
 *
 * Logins are not created here. They are created with the person, on the employee record, because
 * onboarding somebody and giving them a way in is one action, not two.
 */
export function UsersPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const [roleCode, setRoleCode] = useSearchParamState<string>('roleCode', '')
  const [activeFilter, setActiveFilter] = useSearchParamState<string>('active', '')
  const [userId, setUserId] = useNumberParamState('userId')

  const table = useTableState({ defaultSort: 'displayName', defaultDir: 'asc' })
  const list = useAdminUsers({
    ...table.params,
    roleCode: roleCode || undefined,
    active: activeFilter === '' ? undefined : activeFilter === 'true',
  })

  const selected = list.data?.content.find((u) => u.id === userId) ?? null

  const columns: Column<AdminUser>[] = [
    {
      key: 'displayName',
      header: 'Name',
      sortable: true,
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.displayName}</p>
          <p className="truncate text-xs2 text-label2">{r.email}</p>
        </div>
      ),
    },
    {
      key: 'roleCode',
      header: 'Role',
      sortable: true,
      render: (r) => (
        <Tooltip content={ROLE_OPTIONS.find((o) => o.value === r.roleCode)?.description}>
          <span><Chip tone="accent">{ROLE_OPTIONS.find((o) => o.value === r.roleCode)?.label ?? r.roleCode}</Chip></span>
        </Tooltip>
      ),
    },
    {
      key: 'employee',
      header: 'Employee',
      render: (r) =>
        r.employeeId ? (
          <Link to={`/employees/${r.employeeId}`} onClick={(e) => e.stopPropagation()} className="text-accent hover:underline">
            {r.employeeName ?? 'View record'}
          </Link>
        ) : (
          <Tooltip content="This login is not linked to an employee record, so it has no attendance, leave or payslips.">
            <span className="text-label2">Not linked</span>
          </Tooltip>
        ),
    },
    {
      key: 'grantCount',
      header: 'Extra permissions',
      align: 'right',
      tooltip: 'Permissions granted on top of the role baseline.',
      render: (r) => (r.grantCount > 0 ? <Chip tone="accent">{r.grantCount}</Chip> : <span className="text-label2">None</span>),
    },
    { key: 'lastActive', header: 'Last active', render: (r) => fmtDateTime(r.lastActiveAt) },
    { key: 'active', header: 'Status', sortable: true, render: (r) => <ActiveBadge active={r.active} /> },
  ]

  return (
    <>
      <PageHeader
        title="Users and access"
        description="Who can sign in, what role they hold, and any permissions granted on top of it."
        help={
          <HelpPopover title="How access works">
            <HelpItems
              items={[
                { term: 'Where logins come from', text: 'Created with the person on the employee record, so onboarding is one action.' },
                { term: 'One role each', text: 'The role is the baseline. Nobody has two.' },
                { term: 'Grants', text: 'Add or remove a single permission on top of the role, with a reason and usually an expiry.' },
                { term: 'Passwords', text: 'Nobody here ever sets or sees one. People choose their own from an emailed link.' },
                { term: 'Deactivating', text: 'Stops them signing in. Their records and history are kept.' },
              ]}
            />
          </HelpPopover>
        }
        actions={
          can('employee.create.all') ? (
            <Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => navigate('/employees')}>
              Add someone
            </Button>
          ) : undefined
        }
      />

      <Callout tone="neutral" title="Logins are created with the person">
        To give somebody access, add them on the Employees page and choose a role there. The login and the invite are
        created in the same step.
      </Callout>

      <Card className="mt-4">
        <DataTable
          rows={list.data?.content ?? []}
          columns={columns}
          table={table}
          total={list.data?.totalElements}
          loading={list.isLoading}
          fetching={list.isFetching}
          error={list.error}
          onRetry={() => list.refetch()}
          onRowClick={(r) => setUserId(r.id)}
          toolbar={{
            search: 'Search name or email',
            filters: (
              <>
                <Select
                  value={roleCode}
                  onChange={setRoleCode}
                  className="w-52"
                  options={[{ value: '', label: 'All roles' }, ...ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))]}
                />
                <Select
                  value={activeFilter}
                  onChange={setActiveFilter}
                  className="w-40"
                  options={[
                    { value: '', label: 'All logins' },
                    { value: 'true', label: 'Active only' },
                    { value: 'false', label: 'Deactivated' },
                  ]}
                />
              </>
            ),
          }}
          empty={{
            icon: <ShieldCheck className="h-6 w-6" />,
            title: 'No logins',
            description: 'Add someone on the Employees page and choose a role to create their first login.',
          }}
        />
      </Card>

      {selected ? <UserSheet user={selected} onClose={() => setUserId(null)} /> : null}
    </>
  )
}

function UserSheet({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { can, user: me, refresh } = useAuth()
  const isSelf = user.id === me?.id

  const permissions = useUserPermissions(user.id)
  const catalogue = usePermissionCatalogue()
  const auditTable = useTableState({ prefix: 'act.', url: false, size: 20, defaultSort: 'occurredAt', defaultDir: 'desc' })
  const activity = useAuditEvents({ ...auditTable.params, actorUserId: user.id })

  const afterChange = () => { if (isSelf) void refresh() }
  const update = useUpdateUser(afterChange)
  const assignRole = useAssignRole(afterChange)
  const grant = useCreateGrant(afterChange)
  const revoke = useRevokeGrant(afterChange)
  const resend = useResendInvite()

  const [displayName, setDisplayName] = React.useState(user.displayName)
  React.useEffect(() => setDisplayName(user.displayName), [user.id, user.displayName])

  const [deactivating, setDeactivating] = React.useState(false)
  const [revoking, setRevoking] = React.useState<{ id: number; code: string } | null>(null)
  const [form, setForm] = React.useState({ permissionCode: '', effect: 'ALLOW' as 'ALLOW' | 'DENY', reason: '', expiry: '30d' })

  const grouped = React.useMemo(() => {
    const map = new Map<string, string[]>()
    for (const code of permissions.data?.effective ?? []) {
      const resource = code.split('.')[0]
      map.set(resource, [...(map.get(resource) ?? []), code])
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [permissions.data])

  const activeGrants = permissions.data?.grants.filter((g) => g.active) ?? []

  return (
    <>
      <Sheet
        open
        onOpenChange={(next) => !next && onClose()}
        width="lg"
        title={user.displayName}
        description={`${user.email} · ${ROLE_OPTIONS.find((r) => r.value === user.roleCode)?.label ?? user.roleCode}`}
        footer={<Button onClick={onClose}>Close</Button>}
      >
        <Tabs
          items={[
            { value: 'profile', label: 'Profile' },
            { value: 'access', label: 'Access', count: activeGrants.length || null },
            { value: 'activity', label: 'Activity' },
          ]}
        >
          <TabPanel value="profile" className="space-y-4">
            <Field
              label="Display name"
              htmlFor="user-name"
              hint="Shown in the app and on the audit trail. The email address cannot be changed here."
            >
              <div className="flex gap-2">
                <TextInput id="user-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                <Button
                  loading={update.isPending}
                  disabled={!displayName.trim() || displayName === user.displayName}
                  onClick={() => update.mutate({ id: user.id, body: { displayName: displayName.trim() } })}
                >
                  Save
                </Button>
              </div>
            </Field>

            <DetailList
              items={[
                { label: 'Email', value: user.email, hint: 'Comes from the employee record. Change it there.' },
                {
                  label: 'Employee record',
                  value: user.employeeId ? (
                    <Link to={`/employees/${user.employeeId}`} className="text-accent hover:underline">
                      {user.employeeName ?? 'Open record'}
                    </Link>
                  ) : (
                    'Not linked'
                  ),
                },
                { label: 'Extra permissions', value: String(user.grantCount) },
                { label: 'Last active', value: fmtDateTime(user.lastActiveAt) },
              ]}
            />

            <Field
              label="Role"
              hint={
                isSelf
                  ? 'You cannot change your own role.'
                  : 'One role per person. It takes effect the next time they sign in.'
              }
            >
              <Select
                value={user.roleCode}
                disabled={isSelf || !can('role.assign')}
                onChange={(value) => assignRole.mutate({ id: user.id, roleCode: value as RoleCode })}
                options={ROLE_OPTIONS}
              />
            </Field>

            <div className="flex items-center justify-between rounded-card border border-separator px-4 py-3">
              <div>
                <p className="text-sm2 font-medium">Can sign in</p>
                <p className="text-xs2 text-label2">
                  {isSelf
                    ? 'You cannot deactivate your own login.'
                    : 'Deactivating keeps every record but stops them signing in.'}
                </p>
              </div>
              <Toggle
                checked={user.active}
                disabled={isSelf || !can('user.update')}
                onChange={(next) => (next ? update.mutate({ id: user.id, body: { active: true } }) : setDeactivating(true))}
                label="Can sign in"
              />
            </div>

            {user.lastActiveAt === null ? (
              <Callout tone="warn" title="Has never signed in">
                They may not have received the invite, or it may have expired.
                {can('user.update') ? (
                  <Button
                    className="mt-2"
                    size="sm"
                    icon={<Mail className="h-3.5 w-3.5" />}
                    loading={resend.isPending}
                    onClick={() => resend.mutate(user.id)}
                  >
                    Send the invite again
                  </Button>
                ) : null}
              </Callout>
            ) : null}
          </TabPanel>

          <TabPanel value="access" className="space-y-5">
            {can('permission.grant') ? (
              <div>
                <p className="mb-2 text-sm2 font-semibold">Grant a permission</p>
                <div className="space-y-3 rounded-card border border-separator p-4">
                  <Field label="Permission" required hint="Only permissions you hold yourself can be granted.">
                    <Select
                      value={form.permissionCode || null}
                      onChange={(value) => setForm((f) => ({ ...f, permissionCode: String(value) }))}
                      placeholder="Select a permission"
                      options={(catalogue.data ?? []).map((item) => ({
                        value: item.code,
                        label: item.code,
                        group: item.resource,
                        description: item.description,
                        disabled: !item.grantableByMe,
                        disabledReason:
                          item.tier === 'ADMIN'
                            ? 'An administrator-tier permission, which only an administrator may grant.'
                            : 'You do not hold this permission yourself, so you cannot pass it on.',
                      }))}
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Effect" hint="Deny removes a permission the role would otherwise give.">
                      <SegmentedControl
                        value={form.effect}
                        onChange={(v) => setForm((f) => ({ ...f, effect: v }))}
                        options={[
                          { value: 'ALLOW', label: 'Allow' },
                          { value: 'DENY', label: 'Deny' },
                        ]}
                      />
                    </Field>
                    <Field label="Expires" hint="A temporary grant is safer than one nobody remembers to remove.">
                      <Select value={form.expiry} onChange={(v) => setForm((f) => ({ ...f, expiry: String(v) }))} options={EXPIRY_OPTIONS} />
                    </Field>
                  </div>
                  <Field label="Reason" required hint="Kept on the grant and on the audit trail.">
                    <TextArea
                      value={form.reason}
                      onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                      placeholder="Covering payroll while Riley is on leave, until the end of the month."
                    />
                  </Field>
                  <Button
                    variant="primary"
                    loading={grant.isPending}
                    disabled={!form.permissionCode || !form.reason.trim()}
                    onClick={() =>
                      grant.mutate(
                        {
                          userId: user.id,
                          body: {
                            permissionCode: form.permissionCode,
                            effect: form.effect,
                            reason: form.reason.trim(),
                            expiresAt: expiryToIso(form.expiry),
                          },
                        },
                        { onSuccess: () => setForm({ permissionCode: '', effect: 'ALLOW', reason: '', expiry: '30d' }) },
                      )
                    }
                  >
                    Grant permission
                  </Button>
                </div>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-sm2 font-semibold">Granted on top of the role</p>
              {activeGrants.length ? (
                <div className="divide-y divide-separator rounded-card border border-separator">
                  {activeGrants.map((g) => (
                    <div key={g.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="tnum text-sm2 font-medium">{g.permissionCode}</p>
                        <p className="text-xs2 text-label2">
                          {g.effect.toLowerCase()} · {g.reason} · granted by {g.grantedByName}
                          {g.expiresAt ? ` · expires ${fmtDateTime(g.expiresAt)}` : ' · no expiry'}
                        </p>
                      </div>
                      {can('permission.grant') ? (
                        <Button size="sm" onClick={() => setRevoking({ id: g.id, code: g.permissionCode })}>
                          Revoke
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm2 text-label2">
                  Nothing extra. This person has exactly what their role gives them.
                </p>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center gap-1">
                <p className="text-sm2 font-semibold">
                  Everything they can do ({permissions.data?.effective.length ?? 0})
                </p>
                <HelpPopover title="Reading this list" size="sm">
                  <HelpItems
                    items={[
                      { term: 'Grey', text: 'Comes from their role.' },
                      { term: 'Blue', text: 'Granted individually on top of the role.' },
                      { term: 'Implied', text: 'Some permissions include narrower ones, such as read-all including read-own.' },
                    ]}
                  />
                </HelpPopover>
              </div>
              <div className="space-y-2">
                {grouped.map(([resource, codes]) => (
                  <div key={resource} className="rounded-card border border-separator px-4 py-2.5">
                    <p className="text-xs2 font-semibold uppercase tracking-wide text-label2">
                      {resource.replace(/_/g, ' ')}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {codes.map((code) => {
                        const fromRole = permissions.data?.fromRole.includes(code)
                        return (
                          <Tooltip key={code} content={fromRole ? 'From their role' : 'Granted individually'}>
                            <span><Chip tone={fromRole ? 'neutral' : 'accent'}>{code}</Chip></span>
                          </Tooltip>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabPanel>

          <TabPanel value="activity">
            <DataTable
              rows={activity.data?.content ?? []}
              table={auditTable}
              total={activity.data?.totalElements}
              loading={activity.isLoading}
              columns={[
                { key: 'occurredAt', header: 'When', sortable: true, render: (r) => fmtDateTime(r.occurredAt) },
                { key: 'action', header: 'Action', sortable: true, render: (r) => r.action.replace(/_/g, ' ').toLowerCase() },
                {
                  key: 'resource',
                  header: 'On',
                  render: (r) => (r.resourceType ? `${r.resourceType} ${r.resourceId ?? ''}`.trim() : '—'),
                },
                { key: 'outcome', header: 'Outcome', sortable: true, render: (r) => <StatusBadge status={r.outcome} /> },
              ]}
              empty={{
                title: 'Nothing recorded',
                description: 'Actions this person takes appear here as they happen.',
              }}
            />
          </TabPanel>
        </Tabs>
      </Sheet>

      <ConfirmDialog
        open={deactivating}
        onOpenChange={setDeactivating}
        title={`Stop ${user.displayName} signing in?`}
        sentence="Their records, payslips and history are all kept. They simply cannot sign in until this is switched back on."
        confirmLabel="Deactivate login"
        tone="danger"
        loading={update.isPending}
        onConfirm={() =>
          update.mutate({ id: user.id, body: { active: false } }, { onSuccess: () => setDeactivating(false) })
        }
      />

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={`Revoke ${revoking?.code}?`}
        sentence={`${user.displayName} loses this permission the next time their access is refreshed. Their role is unaffected.`}
        confirmLabel="Revoke"
        tone="danger"
        loading={revoke.isPending}
        onConfirm={() => revoking && revoke.mutate(revoking.id, { onSuccess: () => setRevoking(null) })}
      />
    </>
  )
}
