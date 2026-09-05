import * as React from 'react'
import { Link } from 'react-router-dom'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useChangeMyPassword, useMyProfile, useUpdateMyBankAccount, useUpdateMyProfile } from '@/api/hooks'
import { ROLE_OPTIONS } from '@/api/constants'
import { useAuth } from '@/auth/AuthProvider'
import {
  Button, Callout, Card, CardHeader, DetailList, Field, HelpItems, HelpPopover, PageHeader,
  SegmentedControl, Sheet, Skeleton, TextInput,
} from '@/components/ui'
import { errorText } from '@/api/mutation'
import { fmtDate } from '@/lib/format'
import { readTheme, type Theme } from '@/app/theme'

/**
 * What a person can change about themselves without asking anyone.
 *
 * Until now there was nowhere to do any of this: the only way to change a password was to sign out
 * and use the forgotten-password link, and bank details could only be changed by someone else.
 */
export function ProfilePage() {
  const { refresh } = useAuth()
  const profile = useMyProfile()
  const [theme, setThemeState] = React.useState<Theme>(readTheme)
  const [editingBank, setEditingBank] = React.useState(false)

  const applyTheme = (next: Theme) => {
    applyTheme(next)
    setThemeState(next)
  }

  if (profile.isLoading) {
    return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>
  }
  if (profile.isError || !profile.data) {
    return <Callout tone="bad" title="Your profile could not be loaded">Please try again in a moment.</Callout>
  }

  const { user, employee, passwordRule } = profile.data

  return (
    <>
      <PageHeader
        title="Your profile"
        description="Your details, where you are paid, and your password."
        help={
          <HelpPopover title="What you can change here">
            <HelpItems
              items={[
                { term: 'Your name', text: 'Updated on both your login and your employee record, so they never disagree.' },
                { term: 'Work details', text: 'Set by HR. Ask them if something is wrong.' },
                { term: 'Bank details', text: 'You can change these yourself, but your password is checked and the change is recorded.' },
                { term: 'Password', text: 'Nobody else can see or set it, including administrators.' },
              ]}
            />
          </HelpPopover>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <IdentityCard displayName={user.displayName} email={user.email} roleCode={user.roleCode} onSaved={refresh} />

        <Card>
          <CardHeader title="Your work details" subtitle="Maintained by HR. Ask them if any of this is wrong." />
          {employee ? (
            <DetailList
              bordered={false}
              items={[
                { label: 'Employee number', value: employee.employeeNo, tnum: true },
                { label: 'Job title', value: employee.jobTitle || '—' },
                { label: 'Department', value: employee.departmentName ?? '—' },
                { label: 'Manager', value: employee.managerName ?? '—' },
                { label: 'Employment type', value: employee.employeeType.replace('_', ' ').toLowerCase() },
                {
                  label: 'Working schedule',
                  value: employee.workingScheduleName ?? '—',
                  hint: 'Decides how many days and hours each period expects of you.',
                },
                { label: 'Started', value: fmtDate(employee.hireDate) },
              ]}
            />
          ) : (
            <div className="p-5">
              <Callout tone="warn" title="Not linked to an employee record">
                Your login works, but it is not connected to a person, so you have no attendance, leave or payslips.
              </Callout>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Where you are paid"
            subtitle="Only the last four digits are ever shown. The full number is encrypted."
            help={
              <HelpPopover title="Why this asks for your password" size="sm">
                <p>
                  Changing where wages are sent is the change most worth protecting, so it is re-authenticated and
                  written to the audit log with the old and new last four digits.
                </p>
              </HelpPopover>
            }
          />
          <div className="space-y-3 p-5">
            {employee?.bankAccount ? (
              <DetailList
                items={[
                  { label: 'Bank', value: employee.bankAccount.bankName },
                  { label: 'Account', value: `•••• •••• ${employee.bankAccount.accountLast4}`, tnum: true },
                ]}
              />
            ) : (
              <Callout tone="warn" title="No bank details on file">
                Payroll cannot pay you until these are added, and it will flag it before every payrun.
              </Callout>
            )}
            <Button
              variant={employee?.bankAccount ? 'secondary' : 'primary'}
              disabled={!employee}
              onClick={() => setEditingBank(true)}
            >
              {employee?.bankAccount ? 'Change bank details' : 'Add bank details'}
            </Button>
          </div>
        </Card>

        <PasswordCard rule={passwordRule} />

        <Card>
          <CardHeader title="Appearance" subtitle="Applies to this browser only, not to your account." />
          <div className="p-5">
            <Field label="Theme">
              <SegmentedControl
                value={theme}
                onChange={applyTheme}
                options={[
                  { value: 'light', label: <span className="flex items-center gap-1.5"><Sun className="h-3.5 w-3.5" /> Light</span> },
                  { value: 'dark', label: <span className="flex items-center gap-1.5"><Moon className="h-3.5 w-3.5" /> Dark</span> },
                  { value: 'system', label: <span className="flex items-center gap-1.5"><Monitor className="h-3.5 w-3.5" /> System</span> },
                ]}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Your access" subtitle="What your role lets you do." />
          <div className="space-y-3 p-5">
            <DetailList
              items={[
                {
                  label: 'Role',
                  value: ROLE_OPTIONS.find((r) => r.value === user.roleCode)?.label ?? user.roleCode,
                  hint: ROLE_OPTIONS.find((r) => r.value === user.roleCode)?.description,
                },
                { label: 'Sign-in address', value: user.email },
              ]}
            />
            <p className="text-sm2 text-label2">
              Only an administrator can change your role or grant extra permissions. If something you need is missing,
              ask them and name what you are trying to do.
            </p>
            {employee ? (
              <Link to={`/employees/${employee.id}`} className="text-sm2 text-accent hover:underline">
                See your full employee record
              </Link>
            ) : null}
          </div>
        </Card>
      </div>

      <BankSheet open={editingBank} onOpenChange={setEditingBank} />
    </>
  )
}

function IdentityCard({ displayName, email, roleCode, onSaved }: {
  displayName: string
  email: string
  roleCode: string
  onSaved: () => void
}) {
  const [name, setName] = React.useState(displayName)
  const update = useUpdateMyProfile(onSaved)
  React.useEffect(() => setName(displayName), [displayName])

  return (
    <Card>
      <CardHeader title="Your details" subtitle="Your name appears throughout the app and on the audit trail." />
      <div className="space-y-4 p-5">
        <Field label="Display name" required htmlFor="profile-name">
          <div className="flex gap-2">
            <TextInput id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
            <Button
              variant="primary"
              loading={update.isPending}
              disabled={!name.trim() || name === displayName}
              onClick={() => update.mutate({ displayName: name.trim() })}
            >
              Save
            </Button>
          </div>
        </Field>
        <DetailList
          items={[
            { label: 'Email', value: email, hint: 'Set by HR on your employee record, and used to sign in.' },
            { label: 'Role', value: ROLE_OPTIONS.find((r) => r.value === roleCode)?.label ?? roleCode },
          ]}
        />
      </div>
    </Card>
  )
}

function PasswordCard({ rule }: { rule: string }) {
  const change = useChangeMyPassword(() => setForm({ current: '', next: '', confirm: '' }))
  const [form, setForm] = React.useState({ current: '', next: '', confirm: '' })
  const [done, setDone] = React.useState(false)

  const mismatch = form.confirm.length > 0 && form.next !== form.confirm
  const tooShort = form.next.length > 0 && form.next.length < 10
  const valid = form.current && form.next && !mismatch && !tooShort

  return (
    <Card>
      <CardHeader title="Password" subtitle={rule} />
      <div className="space-y-4 p-5">
        {done ? (
          <Callout tone="ok" title="Password changed">
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" aria-hidden /> Use the new one next time you sign in.
            </span>
          </Callout>
        ) : null}
        {change.isError ? <Callout tone="bad" title="Not changed">{errorText(change.error)}</Callout> : null}

        <Field label="Current password" required htmlFor="pw-current">
          <TextInput
            id="pw-current"
            type="password"
            autoComplete="current-password"
            value={form.current}
            onChange={(e) => { setForm({ ...form, current: e.target.value }); setDone(false) }}
          />
        </Field>
        <Field
          label="New password"
          required
          htmlFor="pw-new"
          error={tooShort ? 'Use at least 10 characters.' : undefined}
          hint={tooShort ? undefined : rule}
        >
          <TextInput
            id="pw-new"
            type="password"
            autoComplete="new-password"
            value={form.next}
            invalid={tooShort}
            onChange={(e) => setForm({ ...form, next: e.target.value })}
          />
        </Field>
        <Field
          label="Repeat the new password"
          required
          htmlFor="pw-confirm"
          error={mismatch ? 'The two passwords do not match.' : undefined}
        >
          <TextInput
            id="pw-confirm"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            invalid={mismatch}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </Field>
        <Button
          variant="primary"
          loading={change.isPending}
          disabled={!valid}
          onClick={() =>
            change.mutate(
              { currentPassword: form.current, newPassword: form.next },
              { onSuccess: () => { setDone(true); setForm({ current: '', next: '', confirm: '' }) } },
            )
          }
        >
          Change password
        </Button>
      </div>
    </Card>
  )
}

function BankSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const update = useUpdateMyBankAccount(() => onOpenChange(false))
  const [form, setForm] = React.useState({ bankName: '', accountNumber: '', confirm: '', ifsc: '', password: '' })
  React.useEffect(() => {
    if (open) setForm({ bankName: '', accountNumber: '', confirm: '', ifsc: '', password: '' })
  }, [open])

  const mismatch = form.confirm.length > 0 && form.accountNumber !== form.confirm
  const valid = form.bankName.trim() && form.accountNumber.replace(/\s/g, '').length >= 4 && form.confirm && !mismatch && form.password

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Change your bank details"
      description="Your next payslip is paid to this account. The change is recorded in the audit log."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            loading={update.isPending}
            disabled={!valid}
            onClick={() =>
              update.mutate({
                bankName: form.bankName.trim(),
                accountNumber: form.accountNumber,
                ifsc: form.ifsc || undefined,
                currentPassword: form.password,
              })
            }
          >
            Save bank details
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {update.isError ? <Callout tone="bad" title="Not saved">{errorText(update.error)}</Callout> : null}
        <Field label="Bank name" required htmlFor="my-bank">
          <TextInput id="my-bank" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
        </Field>
        <Field label="Account number" required htmlFor="my-account">
          <TextInput
            id="my-account"
            autoComplete="off"
            value={form.accountNumber}
            onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
          />
        </Field>
        <Field
          label="Repeat the account number"
          required
          htmlFor="my-account-confirm"
          error={mismatch ? 'The two numbers do not match.' : undefined}
          hint={mismatch ? undefined : 'Typed twice, because one wrong digit sends your wages elsewhere.'}
        >
          <TextInput
            id="my-account-confirm"
            autoComplete="off"
            value={form.confirm}
            invalid={mismatch}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </Field>
        <Field label="IFSC" htmlFor="my-ifsc">
          <TextInput id="my-ifsc" value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value })} />
        </Field>
        <Field
          label="Your password"
          required
          htmlFor="my-bank-password"
          hint="Checked before the change is saved, because this decides where your wages go."
        >
          <TextInput
            id="my-bank-password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
      </div>
    </Sheet>
  )
}
