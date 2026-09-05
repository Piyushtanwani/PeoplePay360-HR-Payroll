import * as React from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { Spinner } from '@/components/ui'

/**
 * Home shows whichever dashboard the caller can actually use.
 *
 * Employees hold no dashboard permission, so they used to be bounced to the attendance page. They now
 * get a home screen of their own instead of somebody else's page.
 *
 * Both are fetched on demand: the HR dashboard carries the chart library, which is the largest
 * dependency in the application and useless to an employee who will never see a chart.
 */
const DashboardPage = React.lazy(() =>
  import('./DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const EmployeeDashboard = React.lazy(() =>
  import('./EmployeeDashboard').then((m) => ({ default: m.EmployeeDashboard })),
)

export function HomeRoute() {
  const { can } = useAuth()
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-label2">
          <Spinner />
        </div>
      }
    >
      {can('dashboard.read.hr') ? <DashboardPage /> : <EmployeeDashboard />}
    </React.Suspense>
  )
}
