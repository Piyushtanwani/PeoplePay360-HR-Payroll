import * as React from 'react'
import { LogIn, LogOut } from 'lucide-react'
import { useAttendanceToday, useCheckInOut } from '@/api/hooks'
import { Button, Card, CardHeader, Chip, Spinner, StatusBadge } from '@/components/ui'
import { fmtTime } from '@/lib/format'

/** Own check-in and check-out, with a live count of how long the current entry has been open. */
export function QuickAction() {
  const today = useAttendanceToday()
  const action = useCheckInOut()
  const open = today.data?.openAttendance ?? null
  const [elapsed, setElapsed] = React.useState('')

  React.useEffect(() => {
    if (!open?.checkIn) { setElapsed(''); return }
    const tick = () => {
      const diffMs = Math.max(0, Date.now() - new Date(open.checkIn!).getTime())
      const totalSeconds = Math.floor(diffMs / 1000)
      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      const seconds = totalSeconds % 60
      const pad = (n: number) => String(n).padStart(2, '0')
      setElapsed(`${hours}h ${pad(minutes)}m ${pad(seconds)}s`)
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [open?.checkIn])

  return (
    <Card>
      <CardHeader
        title="Today"
        subtitle={open ? 'You are checked in. Check out when you finish.' : 'Check in when you start work.'}
      />
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          {today.isLoading ? (
            <p className="flex items-center gap-2 text-sm2 text-label2"><Spinner /> Loading…</p>
          ) : open ? (
            <>
              <p className="tnum text-d2 font-semibold">{elapsed || '0h 00m 00s'}</p>
              <p className="text-sm2 text-label2">Since {fmtTime(open.checkIn)}</p>
            </>
          ) : (
            <>
              <p className="text-[17px] font-semibold">Not checked in</p>
              <p className="text-sm2 text-label2">
                {today.data?.todayRows?.length
                  ? `${today.data.todayRows.length} entry today already recorded.`
                  : 'Nothing recorded for today yet.'}
              </p>
            </>
          )}
        </div>
        <Button
          variant="primary"
          size="lg"
          loading={action.isPending}
          icon={open ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
          onClick={() => action.mutate(open ? 'check-out' : 'check-in')}
        >
          {open ? 'Check out' : 'Check in'}
        </Button>
      </div>
      {today.data?.todayRows.length ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-separator px-5 py-3">
          {today.data.todayRows.map((row) => (
            <Chip key={row.id}>
              {fmtTime(row.checkIn)} – {row.checkOut ? fmtTime(row.checkOut) : 'open'}
              <StatusBadge status={row.status} className="ml-1" />
            </Chip>
          ))}
        </div>
      ) : null}
    </Card>
  )
}
