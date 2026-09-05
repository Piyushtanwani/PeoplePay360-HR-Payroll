import { Card, HelpItems, HelpPopover } from '@/components/ui'
import type { LeaveBalance } from '@/api/types'

/**
 * Leave balances as tiles. Shared by the time-off page, the employee record and the employee's own
 * home screen, which each used to carry their own copy of this markup.
 */
export function LeaveBalanceCards({ balances, loading }: { balances: LeaveBalance[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Card key={i} className="h-24 animate-pulse" />)}
      </div>
    )
  }
  if (!balances.length) {
    return (
      <Card className="px-5 py-6 text-center text-sm2 text-label2">
        No leave allocated yet. Balance appears once an allocation is approved.
      </Card>
    )
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {balances.map((balance) => (
        <Card key={balance.typeId} className="p-4">
          <div className="flex items-start justify-between">
            <p className="text-sm2 font-medium">{balance.typeName}</p>
            <HelpPopover title={`${balance.typeName} balance`} size="sm">
              <HelpItems
                items={[
                  { term: 'Available', text: 'Allocated days, less days already approved.' },
                  { term: 'Projected', text: 'Available, less days on requests still waiting for a decision.' },
                  { term: 'Where it comes from', text: 'Approved allocations. A draft allocation grants nothing.' },
                ]}
              />
            </HelpPopover>
          </div>
          <p className="tnum mt-1 text-d3 font-semibold">{balance.available}</p>
          <p className="mt-0.5 text-xs2 text-label2">
            {balance.allocated} allocated · {balance.taken} taken · {balance.pending} pending
          </p>
          {balance.projected !== balance.available ? (
            <p className="mt-1 text-xs2 text-label2">
              {balance.projected} left if every pending request is approved.
            </p>
          ) : null}
        </Card>
      ))}
    </div>
  )
}
