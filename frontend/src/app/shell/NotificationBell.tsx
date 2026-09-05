import * as React from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Bell } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import type { Page, Payrun, TimeOffRequest } from '@/api/types'

export function NotificationBell() {
  const { can } = useAuth()
  const canSeeRequests = can('timeoff_request.read.all')
  const canSeePayruns = can('payrun.read')

  const requests = useQuery({
    queryKey: ['notifications', 'timeoff'],
    enabled: canSeeRequests,
    queryFn: () => api.get<Page<TimeOffRequest>>('/api/timeoff/requests', { state: 'PENDING', size: 50 }),
  })
  const payruns = useQuery({
    queryKey: ['notifications', 'payruns'],
    enabled: canSeePayruns,
    queryFn: () => api.get<Page<Payrun>>('/api/payruns', { size: 50 }),
  })

  const pendingApprovals = requests.data?.totalElements ?? 0
  const openBlockers = (payruns.data?.content ?? []).reduce((sum, run) => sum + run.blockerCount, 0)
  const total = pendingApprovals + openBlockers

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button aria-label={`Notifications (${total})`} className="relative grid h-8 w-8 place-items-center rounded-control text-label2 hover:bg-surface2 hover:text-label">
          <Bell className="h-4 w-4" />
          {total > 0 ? <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-bad" /> : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-80 rounded-card border border-separator bg-surface p-2 shadow-sheet animate-in">
          <p className="px-2 py-1.5 text-xs2 font-semibold uppercase tracking-wide text-label2">Needs attention</p>
          {total === 0 ? (
            <p className="px-2 pb-2 text-sm2 text-label2">Nothing is waiting on you.</p>
          ) : (
            <div className="space-y-1">
              {pendingApprovals > 0 ? (
                <Link to="/timeoff" className="block rounded-control px-2 py-2 text-sm2 hover:bg-surface2">
                  <span className="font-medium">{pendingApprovals} time-off request{pendingApprovals === 1 ? '' : 's'}</span>
                  <span className="block text-xs2 text-label2">Awaiting your approval</span>
                </Link>
              ) : null}
              {openBlockers > 0 ? (
                <Link to="/payroll/payruns" className="block rounded-control px-2 py-2 text-sm2 hover:bg-surface2">
                  <span className="font-medium">{openBlockers} payroll blocker{openBlockers === 1 ? '' : 's'}</span>
                  <span className="block text-xs2 text-label2">Blocking validation of an open payrun</span>
                </Link>
              ) : null}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
