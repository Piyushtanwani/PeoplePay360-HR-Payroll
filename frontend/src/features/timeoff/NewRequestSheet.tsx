import * as React from 'react'
import { useCreateRequest, useEmployeeOptions, useSimulateLeave, useTimeOffTypes } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import { Button, Callout, DateField, Field, Select, Sheet, Spinner, TextArea } from '@/components/ui'
import { todayIso } from '@/lib/dates'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'

/**
 * Requesting leave, with the balance checked as the dates are chosen.
 *
 * The check is debounced and fired explicitly rather than declared as a query, because it is a POST:
 * as a query it re-ran on every remount and could not be reasoned about.
 */
export function NewRequestSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { can, employeeId: myEmployeeId } = useAuth()
  const forOthers = can('timeoff_request.create.all')
  const types = useTimeOffTypes()
  const employees = useEmployeeOptions(open && forOthers)
  const create = useCreateRequest(() => onOpenChange(false))
  const simulate = useSimulateLeave()

  const [form, setForm] = React.useState({
    employeeId: null as number | null,
    typeId: null as number | null,
    startDate: todayIso(),
    endDate: todayIso(),
    reason: '',
  })

  React.useEffect(() => {
    if (open) setForm({ employeeId: null, typeId: null, startDate: todayIso(), endDate: todayIso(), reason: '' })
  }, [open])

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  // Re-check the balance once the dates settle, not on every keystroke.
  const settled = useDebouncedValue(
    { typeId: form.typeId, startDate: form.startDate, endDate: form.endDate, employeeId: form.employeeId },
    400,
  )
  const canSimulate = Boolean(settled.typeId && settled.startDate && settled.endDate)
  const simulateRef = React.useRef(simulate)
  simulateRef.current = simulate

  React.useEffect(() => {
    if (!open || !canSimulate) return
    simulateRef.current.mutate({
      typeId: settled.typeId!,
      startDate: settled.startDate,
      endDate: settled.endDate,
      employeeId: settled.employeeId ?? undefined,
    })
  }, [open, canSimulate, settled.typeId, settled.startDate, settled.endDate, settled.employeeId])

  const check = simulate.data
  const datesBackwards = form.endDate < form.startDate
  const valid = form.typeId && form.startDate && !datesBackwards && (!forOthers || form.employeeId || myEmployeeId)

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Request time off"
      description="Days are counted from the working schedule, so weekends and public holidays are not deducted."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            loading={create.isPending}
            disabled={!valid}
            onClick={() =>
              create.mutate({
                employeeId: form.employeeId ?? undefined,
                typeId: form.typeId,
                startDate: form.startDate,
                endDate: form.endDate,
                reason: form.reason || null,
              })
            }
          >
            Submit request
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {forOthers ? (
          <Field label="Employee" hint="Leave empty to request for yourself.">
            <Select
              value={form.employeeId}
              onChange={(v) => set('employeeId', v)}
              options={(employees.data?.content ?? []).map((e) => ({
                value: e.id,
                label: e.displayName,
                description: e.employeeNo,
              }))}
              placeholder="Myself"
              clearable
              onClear={() => set('employeeId', null)}
            />
          </Field>
        ) : null}

        <Field label="Leave type" required>
          <Select
            value={form.typeId}
            onChange={(v) => set('typeId', v)}
            options={(types.data ?? [])
              .filter((t) => t.active)
              .map((t) => ({
                value: t.id,
                label: t.name,
                description: t.isPaid ? 'Paid leave' : 'Unpaid, and it reduces the month’s pay',
              }))}
            placeholder="Select a type"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First day" required>
            <DateField value={form.startDate} onChange={(v) => set('startDate', v)} />
          </Field>
          <Field label="Last day" required error={datesBackwards ? 'The last day is before the first.' : undefined}>
            <DateField value={form.endDate} min={form.startDate} onChange={(v) => set('endDate', v)} />
          </Field>
        </div>

        {canSimulate ? (
          simulate.isPending ? (
            <p className="flex items-center gap-2 text-sm2 text-label2"><Spinner /> Checking the balance…</p>
          ) : check ? (
            <Callout tone={check.anomaly ? 'warn' : 'neutral'} title={check.anomaly ? 'Not enough balance' : 'Balance check'}>
              {check.days} working {check.days === 1 ? 'day' : 'days'} · {check.available} available ·{' '}
              {check.projectedAfter} left afterwards.
              {check.anomaly ? ` ${check.anomaly} You can still submit; it will be flagged for attention.` : ''}
            </Callout>
          ) : simulate.isError ? (
            <Callout tone="neutral">The balance could not be checked, but you can still submit the request.</Callout>
          ) : null
        ) : null}

        <Field label="Reason" hint="Optional, and visible to whoever approves it.">
          <TextArea value={form.reason} onChange={(e) => set('reason', e.target.value)} />
        </Field>
      </div>
    </Sheet>
  )
}
