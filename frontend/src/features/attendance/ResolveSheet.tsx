import * as React from 'react'
import { useResolveException } from '@/api/hooks'
import { Button, Callout, DetailList, Field, Select, Sheet, StatusBadge, TextArea, TimeField } from '@/components/ui'
import { combineDateTime } from '@/lib/dates'
import { fmtDate } from '@/lib/format'
import { errorText } from '@/api/mutation'
import type { AttendanceException } from '@/api/types'

/**
 * Resolving an attendance exception.
 *
 * A reason is always required, because a resolved exception with no explanation is indistinguishable
 * from one nobody looked at. For a missing check-out the panel can also close the entry, and the time
 * it sends is the exception's own date combined with the chosen clock time; sending a bare "17:30"
 * is what made this action fail silently before.
 */
export function ResolveSheet({ exception, onOpenChange }: {
  exception: AttendanceException | null
  onOpenChange: (open: boolean) => void
}) {
  const resolve = useResolveException(() => onOpenChange(false))
  const canSetCheckOut = exception?.attendanceId !== null && exception?.type === 'MISSING_CHECKOUT'
  const scheduledEnd = exception?.scheduledEnd?.slice(0, 5) ?? null

  const [mode, setMode] = React.useState<'scheduled' | 'custom' | 'none'>('none')
  const [time, setTime] = React.useState('17:30')
  const [reason, setReason] = React.useState('')

  React.useEffect(() => {
    if (!exception) return
    setMode(canSetCheckOut ? (scheduledEnd ? 'scheduled' : 'custom') : 'none')
    setTime(scheduledEnd ?? '17:30')
    setReason('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exception?.id])

  const chosenTime = mode === 'scheduled' ? scheduledEnd ?? '' : time
  const valid = reason.trim().length > 0 && (mode === 'none' || chosenTime)

  const submit = () => {
    if (!exception) return
    resolve.mutate({
      id: exception.id,
      reason: reason.trim(),
      // Only a missing check-out carries a time; anything else is resolved with the reason alone.
      checkOut: mode === 'none' ? undefined : combineDateTime(exception.date, chosenTime),
    })
  }

  return (
    <Sheet
      open={exception !== null}
      onOpenChange={onOpenChange}
      title="Resolve exception"
      description="Recorded against your name, with the reason, so the record explains itself later."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" loading={resolve.isPending} disabled={!valid} onClick={submit}>
            Resolve
          </Button>
        </>
      }
    >
      {exception ? (
        <div className="space-y-4">
          <DetailList
            items={[
              { label: 'Employee', value: exception.employeeName },
              { label: 'Date', value: fmtDate(exception.date) },
              { label: 'Exception', value: <StatusBadge status={exception.type} /> },
              {
                label: 'Scheduled finish',
                value: scheduledEnd ?? 'No schedule for that day',
                hidden: !canSetCheckOut,
                tnum: true,
              },
            ]}
          />

          {canSetCheckOut ? (
            <Field label="Check-out time" hint="Closing the entry reclassifies the day from the corrected times.">
              <div className="space-y-2">
                <Select
                  value={mode}
                  onChange={(v) => setMode(v as typeof mode)}
                  options={[
                    {
                      value: 'scheduled',
                      label: scheduledEnd ? `Scheduled finish (${scheduledEnd})` : 'Scheduled finish',
                      disabled: !scheduledEnd,
                      disabledReason: 'This employee has no schedule for that weekday.',
                    },
                    { value: 'custom', label: 'A specific time' },
                    { value: 'none', label: 'Leave the entry open, just resolve it' },
                  ]}
                />
                {mode === 'custom' ? <TimeField value={time} onChange={setTime} /> : null}
              </div>
            </Field>
          ) : (
            <Callout tone="neutral">
              A {exception.type.replace(/_/g, ' ').toLowerCase()} has no times to correct, so resolving it records your
              explanation and closes it.
            </Callout>
          )}

          <Field
            label="Reason"
            required
            htmlFor="resolve-reason"
            hint="What made this acceptable. Whoever reads the record later will see only this."
          >
            <TextArea
              id="resolve-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Confirmed with their line manager; they left at the usual time."
            />
          </Field>

          {resolve.isError ? <Callout tone="bad" title="Not resolved">{errorText(resolve.error)}</Callout> : null}
        </div>
      ) : null}
    </Sheet>
  )
}
