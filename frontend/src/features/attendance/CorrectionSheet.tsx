import * as React from 'react'
import { useCorrectAttendance } from '@/api/hooks'
import { Button, Callout, DetailList, Field, Sheet, StatusBadge, TextArea, TimeField } from '@/components/ui'
import { combineDateTime, timeOf } from '@/lib/dates'
import { fmtDate, minutesToHours } from '@/lib/format'
import { errorText } from '@/api/mutation'
import type { Attendance } from '@/api/types'

/**
 * Correcting the times on an attendance record.
 *
 * The original check-out is kept, the change is attributed, and the day is reclassified from the new
 * times. Nobody may correct their own record, which the table enforces before this opens.
 */
export function CorrectionSheet({ record, onOpenChange }: {
  record: Attendance | null
  onOpenChange: (open: boolean) => void
}) {
  const correct = useCorrectAttendance(() => onOpenChange(false))
  const [checkIn, setCheckIn] = React.useState('')
  const [checkOut, setCheckOut] = React.useState('')
  const [reason, setReason] = React.useState('')

  React.useEffect(() => {
    if (!record) return
    setCheckIn(timeOf(record.checkIn))
    setCheckOut(timeOf(record.checkOut))
    setReason('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id])

  const outBeforeIn = checkIn && checkOut && checkOut <= checkIn
  const valid = reason.trim().length > 0 && !outBeforeIn && (checkIn || checkOut)

  return (
    <Sheet
      open={record !== null}
      onOpenChange={onOpenChange}
      title="Correct attendance"
      description="The original times are kept on the record, along with your name and the reason."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            loading={correct.isPending}
            disabled={!valid}
            onClick={() =>
              record &&
              correct.mutate({
                id: record.id,
                checkIn: checkIn ? combineDateTime(record.workDate, checkIn) : undefined,
                checkOut: checkOut ? combineDateTime(record.workDate, checkOut) : undefined,
                editReason: reason.trim(),
              })
            }
          >
            Save correction
          </Button>
        </>
      }
    >
      {record ? (
        <div className="space-y-4">
          <DetailList
            items={[
              { label: 'Employee', value: record.employeeName },
              { label: 'Date', value: fmtDate(record.workDate) },
              { label: 'Currently', value: <StatusBadge status={record.status} /> },
              { label: 'Worked', value: minutesToHours(record.workedMinutes), tnum: true },
              { label: 'Scheduled', value: minutesToHours(record.scheduledMinutes), tnum: true },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Check in">
              <TimeField value={checkIn} onChange={setCheckIn} />
            </Field>
            <Field label="Check out" error={outBeforeIn ? 'Check-out must be after check-in.' : undefined}>
              <TimeField value={checkOut} onChange={setCheckOut} />
            </Field>
          </div>
          <Field label="Reason" required htmlFor="correct-reason" hint="Kept on the record and on the audit trail.">
            <TextArea
              id="correct-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Forgot to check out; their manager confirmed the finish time."
            />
          </Field>
          {correct.isError ? <Callout tone="bad" title="Not saved">{errorText(correct.error)}</Callout> : null}
        </div>
      ) : null}
    </Sheet>
  )
}
