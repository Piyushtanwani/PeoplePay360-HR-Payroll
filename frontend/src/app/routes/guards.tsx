import * as React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { Button, NotPermitted, Spinner } from '@/components/ui'

export function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center gap-2 text-label2">
      <Spinner /> Loading workspace…
    </div>
  )
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, me, loading, sessionError, retry } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingScreen />

  // The token is still valid but the backend did not answer. Signing the user out
  // here is what produced the spurious redirects to the login page.
  if (token && !me && sessionError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <div>
          <p className="text-body font-medium">Cannot reach the server</p>
          <p className="mt-1 text-sm2 text-label2">{sessionError}</p>
        </div>
        <Button variant="primary" onClick={retry}>Try again</Button>
      </div>
    )
  }

  if (!token || !me) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search + location.hash }} />
  }
  return <>{children}</>
}

export function RequirePermission({ permission, children }: { permission: string | string[]; children: React.ReactNode }) {
  const { canAny } = useAuth()
  const codes = Array.isArray(permission) ? permission : [permission]
  if (!canAny(codes)) return <NotPermitted requiredPermission={codes[0]} />
  return <>{children}</>
}
