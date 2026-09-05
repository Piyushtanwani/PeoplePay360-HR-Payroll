import * as React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { NotPermitted, Spinner } from '@/components/ui'

export function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center gap-2 text-label2">
      <Spinner /> Loading workspace…
    </div>
  )
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, me, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingScreen />
  if (!token || !me) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}

export function RequirePermission({ permission, children }: { permission: string | string[]; children: React.ReactNode }) {
  const { canAny } = useAuth()
  const codes = Array.isArray(permission) ? permission : [permission]
  if (!canAny(codes)) return <NotPermitted requiredPermission={codes[0]} />
  return <>{children}</>
}
