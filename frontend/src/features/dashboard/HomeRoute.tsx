import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { DashboardPage } from './DashboardPage'

/** Employees have no dashboard permission, so home becomes their self-service screen. */
export function HomeRoute() {
  const { can } = useAuth()
  if (can('dashboard.read.hr')) return <DashboardPage />
  return <Navigate to="/attendance" replace />
}
