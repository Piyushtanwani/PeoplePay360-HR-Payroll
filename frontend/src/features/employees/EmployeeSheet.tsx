import * as React from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { useContractTemplateOptions, useDepartments, useEmployeeOptions, useScheduleNames } from '@/api/hooks'
import { EMPLOYEE_TYPE_OPTIONS, ROLE_OPTIONS } from '@/api/constants'
import { Button, Callout, DateField, Field, MoneyInput, Select, Sheet, TextInput, Toggle } from '@/components/ui'
import { todayIso } from '@/lib/dates'
import type { Employee, EmployeeType, RoleCode, SaveEmployee } from '@/api/types'

/**
 * Creating or editing a person.
 *
 * Creating one now does three things at once, because doing them separately is how people ended up in
 * the system without a contract or a way to sign in: it records the person, applies a contract
 * template, and issues a login with a role.
 */
export function EmployeeSheet({ open, onOpenChange, employee, saving, onSubmit }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Absent when creating. */
  employee?: Employee | null
  saving: boolean
  onSubmit: (body: SaveEmployee) => void
}) {
  const { can } = useAuth()
  const editing = Boolean(employee)
  const canIssueLogins = can('user.create')

  const departments = useDepartments()
  const schedules = useScheduleNames()
  const managers = useEmployeeOptions(open)
  const templates = useContractTemplateOptions(open && !editing && can('contract.create.all'))

  const empty = {
    displayName: '',
    workEmail: '',
    jobTitle: '',
    departmentId: null as number | null,
    managerId: null as number | null,
    employeeType: 'FULL_TIME' as EmployeeType,
    workingScheduleId: null as number | null,
    hireDate: todayIso(),
    roleCode: null as RoleCode | null,
    contractTemplateId: null as number | null,
    wage: null as number | null,
    active: true,
  }
  const [form, setForm] = React.useState(empty)
  const [createLogin, setCreateLogin] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    if (employee) {
      setForm({
        displayName: employee.displayName,
        workEmail: employee.workEmail ?? '',
        jobTitle: employee.jobTitle ?? '',
        departmentId: employee.departmentId ?? null,
        managerId: employee.managerId,
        employeeType: employee.employeeType,
        workingScheduleId: employee.workingScheduleId,
        hireDate: employee.hireDate ?? todayIso(),
        roleCode: employee.roleCode,
        contractTemplateId: null,
        wage: null,
        active: employee.active,
      })
      setCreateLogin(false)
    } else {
      setForm(empty)
      setCreateLogin(canIssueLogins)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee?.id])

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const template = templates.data?.content.find((t) => t.id === form.contractTemplateId)
  const needsEmail = createLogin && !editing
  const emailLooksValid = form.workEmail.includes('@')
  const valid =
    form.displayName.trim().length > 0 &&
    (!needsEmail || emailLooksValid) &&
    (!createLogin || editing || Boolean(form.roleCode))

  const submit = () => {
    const body: SaveEmployee = {
      displayName: form.displayName.trim(),
      departmentId: form.departmentId,
      managerId: form.managerId,
      employeeType: form.employeeType,
      workingScheduleId: form.workingScheduleId,
      hireDate: form.hireDate || null,
      workEmail: form.workEmail.trim() || null,
      jobTitle: form.jobTitle.trim() || null,
    }
    if (editing) {
      body.active = form.active
      // Only send a role when it actually changed, so an edit does not reassign it every save.
      if (form.roleCode && form.roleCode !== employee?.roleCode) body.roleCode = form.roleCode
    } else {
      if (createLogin && form.roleCode) body.roleCode = form.roleCode
      if (form.contractTemplateId) {
        body.contractTemplateId = form.contractTemplateId
        body.contractStartDate = form.hireDate || todayIso()
        if (form.wage) body.wage = form.wage
      }
    }
    onSubmit(body)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      title={editing ? `Edit ${employee?.displayName}` : 'New employee'}
      description={
        editing
          ? 'Changes apply immediately. Pay is driven by the contract, not by these details.'
          : 'Records the person, and optionally gives them a contract and a way to sign in.'
      }
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" loading={saving} disabled={!valid} onClick={submit}>
            {editing ? 'Save changes' : 'Create employee'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <section className="space-y-4">
          <Field label="Full name" required htmlFor="emp-name">
            <TextInput
              id="emp-name"
              value={form.displayName}
              onChange={(e) => set('displayName', e.target.value)}
              placeholder="Avery Nolan"
            />
          </Field>
          <Field
            label="Work email"
            required={needsEmail}
            htmlFor="emp-email"
            hint={needsEmail ? 'The invite is sent here, and it becomes their sign-in address.' : undefined}
            error={needsEmail && form.workEmail && !emailLooksValid ? 'That does not look like an email address.' : undefined}
          >
            <TextInput
              id="emp-email"
              type="email"
              value={form.workEmail}
              onChange={(e) => set('workEmail', e.target.value)}
              placeholder="avery.nolan@company.com"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Department">
              <Select
                value={form.departmentId}
                onChange={(v) => set('departmentId', v)}
                options={(departments.data ?? []).map((d) => ({
                  value: d.id,
                  label: d.name,
                  description: `${d.employeeCount} employees`,
                }))}
                placeholder="Select department"
                clearable
                onClear={() => set('departmentId', null)}
              />
            </Field>
            <Field label="Employment type" required>
              <Select
                value={form.employeeType}
                onChange={(v) => set('employeeType', v as EmployeeType)}
                options={EMPLOYEE_TYPE_OPTIONS}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Job title">
              <TextInput value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} placeholder="Payroll Specialist" />
            </Field>
            <Field label="Hire date" hint="Also the start date of a contract created from a template.">
              <DateField value={form.hireDate} onChange={(v) => set('hireDate', v)} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Manager">
              <Select
                value={form.managerId}
                onChange={(v) => set('managerId', v)}
                options={(managers.data?.content ?? [])
                  .filter((m) => m.id !== employee?.id)
                  .map((m) => ({ value: m.id, label: m.displayName, description: m.jobTitle }))}
                placeholder="Select manager"
                clearable
                onClear={() => set('managerId', null)}
              />
            </Field>
            <Field
              label="Working schedule"
              hint="Decides how many days and hours a period expects."
            >
              <Select
                value={form.workingScheduleId}
                onChange={(v) => set('workingScheduleId', v)}
                options={(schedules.data ?? []).map((s) => ({
                  value: s.id,
                  label: s.name,
                  description: `${s.weeklyHours} hours a week`,
                }))}
                placeholder="Select schedule"
                clearable
                onClear={() => set('workingScheduleId', null)}
              />
            </Field>
          </div>
        </section>

        {!editing && can('contract.create.all') ? (
          <section className="space-y-4 border-t border-separator pt-5">
            <div>
              <h3 className="text-sm2 font-semibold">Contract</h3>
              <p className="mt-0.5 text-xs2 text-label2">
                Optional. Choosing a template creates a running contract from the hire date, which is what payroll reads.
              </p>
            </div>
            <Field label="Contract template">
              <Select
                value={form.contractTemplateId}
                onChange={(v) => set('contractTemplateId', v)}
                options={(templates.data?.content ?? []).map((t) => ({
                  value: t.id,
                  label: t.name,
                  description: `${t.jobTitle ?? 'Any role'} · ${t.salaryStructureName ?? 'no structure'}`,
                }))}
                placeholder="No contract yet"
                clearable
                onClear={() => set('contractTemplateId', null)}
                emptyMessage="No templates yet. Create one on the Contracts page."
              />
            </Field>
            {template ? (
              <Field label="Wage" hint={`The template says ${template.wageType.toLowerCase()}. Change it only for this person.`}>
                <MoneyInput value={form.wage ?? template.wage} onChange={(v) => set('wage', v)} />
              </Field>
            ) : null}
          </section>
        ) : null}

        <section className="space-y-4 border-t border-separator pt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm2 font-semibold">Access</h3>
              <p className="mt-0.5 text-xs2 text-label2">
                {editing
                  ? employee?.roleCode
                    ? 'Changing the role takes effect the next time they sign in.'
                    : 'This person has no login yet. Create one from their record.'
                  : canIssueLogins
                    ? 'A login is created and an invite emailed. They choose their own password.'
                    : 'Your role cannot create logins. An administrator can add one afterwards.'}
              </p>
            </div>
            {!editing && canIssueLogins ? (
              <Toggle checked={createLogin} onChange={setCreateLogin} label="Create a login" />
            ) : null}
          </div>
          {(createLogin && !editing) || (editing && employee?.roleCode) ? (
            <Field
              label="Role"
              required={!editing}
              hint="One role per person. Extra permissions can be granted on top by an administrator."
            >
              <Select
                value={form.roleCode}
                onChange={(v) => set('roleCode', v as RoleCode)}
                options={ROLE_OPTIONS}
                placeholder="Select a role"
                disabled={editing && !can('role.assign')}
              />
            </Field>
          ) : null}
          {editing ? (
            <div className="flex items-center justify-between rounded-card border border-separator px-4 py-3">
              <div>
                <p className="text-sm2 font-medium">Active</p>
                <p className="text-xs2 text-label2">
                  Switching this off keeps every record but removes them from payruns and lists.
                </p>
              </div>
              <Toggle checked={form.active} onChange={(v) => set('active', v)} label="Active" />
            </div>
          ) : null}
          {!editing && createLogin && !canIssueLogins ? (
            <Callout tone="warn">Your role cannot create logins, so this employee will be created without one.</Callout>
          ) : null}
        </section>
      </div>
    </Sheet>
  )
}
