import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Tabs from '@radix-ui/react-tabs'
import { Mail, Plus, Search, Sparkles, UserPlus } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import {
  Button, Card, Chip, DataTable, Field, PageHeader, SegmentedControl, Select, Sheet, StatusBadge,
  TextArea, TextInput, Tooltip, useToast,
} from '@/components/ui'
import { fmtDateTime } from '@/lib/format'
import type { AdminUser, AuditEvent, CreateUserResult, Grant, InvitableEmployee, Page, PermissionCatalogItem, RoleCode } from '@/api/types'

const TAB_CLASS = 'rounded-control px-3 py-1.5 text-sm2 font-medium text-label2 data-[state=active]:bg-surface data-[state=active]:text-label data-[state=active]:shadow-sm'
const ROLES: { value: RoleCode; label: string }[] = [
  { value: 'EMPLOYEE', label: 'Employee' }, { value: 'HR_MANAGER', label: 'HR Manager' },
  { value: 'HR_PAYROLL_USER', label: 'HR Payroll User' }, { value: 'HR_PAYROLL_MANAGER', label: 'HR Payroll Manager' },
  { value: 'ADMIN', label: 'Administrator' },
]
const EXPIRY_OPTIONS = [
  { value: '', label: 'No expiry' }, { value: '2h', label: '2 hours' }, { value: '1d', label: '1 day' },
  { value: '7d', label: '7 days' }, { value: '30d', label: '30 days' },
]

function expiryToIso(value: string) {
  if (!value) return null
  const hours = value === '2h' ? 2 : value === '1d' ? 24 : value === '7d' ? 168 : 720
  return new Date(Date.now() + hours * 3600_000).toISOString()
}

export function UsersPage() {
  const [q, setQ] = React.useState('')
  const [selected, setSelected] = React.useState<AdminUser | null>(null)
  const [creating, setCreating] = React.useState(false)
  const query = useQuery({ queryKey: ['admin', 'users', q], queryFn: () => api.page<AdminUser>('/api/admin/users', { q, size: 100 }) })

  return (
    <>
      <PageHeader
        title="Users & access"
        description="A login is created for an employee who is already onboarded. They receive an email to set their own password."
        actions={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>New user</Button>}
      />

      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-label2" />
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…" className="pl-8" />
        </div>
      </div>

      <Card>
        <DataTable
          rows={query.data?.content ?? []}
          loading={query.isLoading}
          onRowClick={setSelected}
          columns={[
            { key: 'name', header: 'Name', render: (r) => <span className="font-medium">{r.displayName}</span>, sortValue: (r) => r.displayName },
            { key: 'email', header: 'Email', render: (r) => <span className="text-label2">{r.email}</span> },
            { key: 'role', header: 'Role', render: (r) => <Chip tone="accent">{r.roleCode.replace(/_/g, ' ').toLowerCase()}</Chip> },
            { key: 'employee', header: 'Employee', render: (r) => r.employeeName ?? '—' },
            { key: 'grants', header: 'Grants', align: 'right', render: (r) => r.grantCount },
            { key: 'active', header: 'Status', render: (r) => <StatusBadge status={r.active ? 'ACTIVE' : 'CANCELLED'} /> },
            { key: 'last', header: 'Last active', render: (r) => fmtDateTime(r.lastActiveAt) },
          ]}
        />
      </Card>

      {selected ? <UserSheet user={selected} onClose={() => setSelected(null)} /> : null}
      {creating ? <NewUserSheet onClose={() => setCreating(false)} /> : null}
    </>
  )
}

/**
 * Creating a login starts from an employee record: the picker only lists onboarded,
 * active employees who do not already have an account.
 */
function NewUserSheet({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [employeeId, setEmployeeId] = React.useState<number | null>(null)
  const [roleCode, setRoleCode] = React.useState<RoleCode>('EMPLOYEE')
  const [email, setEmail] = React.useState('')
  const [displayName, setDisplayName] = React.useState('')
  const [touchedEmail, setTouchedEmail] = React.useState(false)

  const employees = useQuery({
    queryKey: ['admin', 'invitable-employees'],
    queryFn: () => api.get<InvitableEmployee[]>('/api/admin/users/invitable-employees'),
  })

  const chosen = (employees.data ?? []).find((e) => e.employeeId === employeeId) ?? null

  // Selecting an employee prefills identity; the admin can still correct the address.
  React.useEffect(() => {
    if (!chosen) return
    setDisplayName(chosen.displayName)
    if (!touchedEmail) setEmail(chosen.workEmail ?? '')
  }, [chosen, touchedEmail])

  const create = useMutation({
    mutationFn: () => api.post<CreateUserResult>('/api/admin/users', {
      email, displayName, roleCode, employeeId, sendInvite: true,
    }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      toast.push({
        tone: r.inviteSent ? 'success' : 'error',
        title: r.inviteSent ? 'User created and invited' : 'User created, invite not sent',
        detail: r.inviteMessage,
      })
      onClose()
    },
    onError: (e) => toast.push({
      tone: 'error', title: 'Could not create user',
      detail: e instanceof ApiError ? e.detail : 'Unexpected error.',
    }),
  })

  const valid = employeeId !== null && email.includes('@') && displayName.trim().length > 0

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && onClose()}
      title="New user"
      description="Pick the employee first. They set their own password from an emailed link, so no password is entered here."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={create.isPending} disabled={!valid}
            icon={<Mail className="h-4 w-4" />} onClick={() => create.mutate()}>
            Create and send invite
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Employee" required
          hint={employees.data && employees.data.length === 0
            ? 'Every active employee already has a login. Onboard the employee first under Employees.'
            : 'Only onboarded employees without a login are listed.'}>
          <Select
            value={employeeId}
            onChange={setEmployeeId}
            loading={employees.isLoading}
            placeholder="Select an employee"
            options={(employees.data ?? []).map((e) => ({
              value: e.employeeId,
              label: e.displayName,
              description: [e.employeeNo, e.jobTitle, e.departmentName].filter(Boolean).join(' · '),
            }))}
          />
        </Field>

        {chosen ? (
          <>
            <Field label="Work email" required htmlFor="nuemail" hint="The invite is sent here.">
              <TextInput id="nuemail" type="email" value={email}
                onChange={(e) => { setTouchedEmail(true); setEmail(e.target.value) }}
                placeholder="name@company.com" />
            </Field>
            <Field label="Display name" required htmlFor="nuname">
              <TextInput id="nuname" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </Field>
            <Field label="Role" required hint="Determines which modules they see after signing in.">
              <Select value={roleCode} onChange={(v) => setRoleCode(v as RoleCode)} options={ROLES} />
            </Field>
            <div className="flex items-start gap-2.5 rounded-card border border-separator bg-surface2/50 p-3 text-sm2">
              <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <p className="text-label2">
                No password is set here. {displayName || 'The employee'} receives a single-use link that
                expires in 48 hours.
              </p>
            </div>
          </>
        ) : null}
      </div>
    </Sheet>
  )
}

function UserSheet({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { user: me, refresh } = useAuth()
  const [tab, setTab] = React.useState('profile')

  const permissions = useQuery({
    queryKey: ['admin', 'users', user.id, 'permissions'],
    queryFn: () => api.get<{ effective: string[]; fromRole: string[]; grants: Grant[] }>(`/api/admin/users/${user.id}/permissions`),
  })
  const catalogue = useQuery({ queryKey: ['admin', 'permissions'], queryFn: () => api.get<PermissionCatalogItem[]>('/api/admin/permissions') })
  const audit = useQuery({
    queryKey: ['admin', 'audit', user.id],
    queryFn: () => api.page<AuditEvent>('/api/admin/audit', { actorUserId: user.id, size: 20 }),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin'] })
    if (user.id === me?.id) void refresh()
  }

  const grant = useMutation({
    mutationFn: (body: { permissionCode: string; effect: 'ALLOW' | 'DENY'; reason: string; expiresAt: string | null }) =>
      api.post<Grant>(`/api/admin/users/${user.id}/grants`, body),
    onSuccess: () => { invalidate(); toast.push({ tone: 'success', title: 'Grant added', detail: 'The user sees the change after their next permission refresh.' }) },
    onError: (error) => toast.push({ tone: 'error', title: 'Could not grant permission', detail: error instanceof ApiError ? error.detail : '' }),
  })

  const revoke = useMutation({
    mutationFn: (grantId: number) => api.del(`/api/admin/grants/${grantId}`),
    onSuccess: () => { invalidate(); toast.push({ tone: 'info', title: 'Grant revoked' }) },
  })

  const changeRole = useMutation({
    mutationFn: (roleCode: RoleCode) => api.post(`/api/admin/users/${user.id}/role`, { roleCode }),
    onSuccess: () => { invalidate(); toast.push({ tone: 'success', title: 'Role updated' }) },
    onError: (error) => toast.push({ tone: 'error', title: 'Could not change role', detail: error instanceof ApiError ? error.detail : '' }),
  })

  const [form, setForm] = React.useState({ permissionCode: '', effect: 'ALLOW' as 'ALLOW' | 'DENY', reason: '', expiry: '30d' })

  const grouped = React.useMemo(() => {
    const map = new Map<string, string[]>()
    for (const code of permissions.data?.effective ?? []) {
      const resource = code.split('.')[0]
      map.set(resource, [...(map.get(resource) ?? []), code])
    }
    return Array.from(map.entries())
  }, [permissions.data])

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()} width="lg" title={user.displayName} description={`${user.email} · ${user.roleCode.replace(/_/g, ' ').toLowerCase()}`}
      footer={<Button onClick={onClose}>Close</Button>}>
      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className="mb-4 inline-flex gap-1 rounded-control bg-surface2 p-0.5">
          <Tabs.Trigger value="profile" className={TAB_CLASS}>Profile</Tabs.Trigger>
          <Tabs.Trigger value="access" className={TAB_CLASS}>Access</Tabs.Trigger>
          <Tabs.Trigger value="activity" className={TAB_CLASS}>Activity</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="profile" className="space-y-4">
          <Field label="Primary role" hint="One role per user. Grants layer on top of the role baseline.">
            <Select value={user.roleCode} onChange={(value) => changeRole.mutate(value as RoleCode)} options={ROLES} />
          </Field>
          <div className="rounded-card border border-separator">
            {[['Email', user.email], ['Linked employee', user.employeeName ?? '—'], ['Active grants', String(user.grantCount)], ['Last active', fmtDateTime(user.lastActiveAt)]].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-separator px-4 py-2.5 text-sm2 last:border-0">
                <span className="text-label2">{label}</span><span className="font-medium">{value}</span>
              </div>
            ))}
          </div>
          <Button
            icon={<Sparkles className="h-4 w-4" />}
            onClick={() => setForm((f) => ({ ...f, permissionCode: 'chat.access', reason: 'assistant pilot' }))}
          >
            Prepare “Give assistant access”
          </Button>
        </Tabs.Content>

        <Tabs.Content value="access" className="space-y-5">
          <div>
            <p className="mb-2 text-sm2 font-semibold">Add a grant</p>
            <div className="space-y-3 rounded-card border border-separator p-4">
              <Field label="Permission" required>
                <Select
                  value={form.permissionCode || null}
                  onChange={(value) => setForm((f) => ({ ...f, permissionCode: String(value) }))}
                  placeholder="Select a permission"
                  options={(catalogue.data ?? []).map((item) => ({
                    value: item.code, label: item.code, group: item.resource, description: item.description,
                    disabled: !item.grantableByMe,
                    disabledReason: item.tier === 'ADMIN' ? 'Administrator-tier permission' : 'You do not hold this permission yourself',
                  }))}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Effect"><SegmentedControl value={form.effect} onChange={(v) => setForm((f) => ({ ...f, effect: v }))} options={[{ value: 'ALLOW', label: 'Allow' }, { value: 'DENY', label: 'Deny' }]} /></Field>
                <Field label="Expiry"><Select value={form.expiry} onChange={(v) => setForm((f) => ({ ...f, expiry: String(v) }))} options={EXPIRY_OPTIONS} /></Field>
              </div>
              <Field label="Reason" required><TextArea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="assistant pilot" /></Field>
              <Button
                variant="primary"
                loading={grant.isPending}
                disabled={!form.permissionCode || !form.reason.trim()}
                onClick={() => grant.mutate({ permissionCode: form.permissionCode, effect: form.effect, reason: form.reason, expiresAt: expiryToIso(form.expiry) })}
              >
                Add grant
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm2 font-semibold">Active grants</p>
            {permissions.data?.grants.filter((g) => g.active).length ? (
              <div className="divide-y divide-separator rounded-card border border-separator">
                {permissions.data.grants.filter((g) => g.active).map((g) => (
                  <div key={g.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="tnum text-sm2 font-medium">{g.permissionCode}</p>
                      <p className="text-xs2 text-label2">{g.effect} · {g.reason} · by {g.grantedByName}{g.expiresAt ? ` · expires ${fmtDateTime(g.expiresAt)}` : ''}</p>
                    </div>
                    <Button size="sm" onClick={() => revoke.mutate(g.id)}>Revoke</Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm2 text-label2">No explicit grants. This user holds only their role baseline.</p>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm2 font-semibold">Effective permissions ({permissions.data?.effective.length ?? 0})</p>
            <div className="space-y-2">
              {grouped.map(([resource, codes]) => (
                <div key={resource} className="rounded-card border border-separator px-4 py-2.5">
                  <p className="text-xs2 font-semibold uppercase tracking-wide text-label2">{resource.replace(/_/g, ' ')}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {codes.map((code) => {
                      const fromRole = permissions.data?.fromRole.includes(code)
                      return (
                        <Tooltip key={code} content={fromRole ? 'From role' : 'From grant'}>
                          <span><Chip tone={fromRole ? 'neutral' : 'accent'}>{code}</Chip></span>
                        </Tooltip>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="activity">
          <div className="divide-y divide-separator rounded-card border border-separator">
            {(audit.data?.content ?? []).map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm2">
                <div className="min-w-0">
                  <p className="font-medium">{event.action.replace(/_/g, ' ').toLowerCase()}</p>
                  <p className="text-xs2 text-label2">{event.resourceType} #{event.resourceId} · {event.channel}</p>
                </div>
                <div className="text-right">
                  <StatusBadge status={event.outcome} />
                  <p className="mt-0.5 text-xs2 text-label2">{fmtDateTime(event.occurredAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </Sheet>
  )
}
