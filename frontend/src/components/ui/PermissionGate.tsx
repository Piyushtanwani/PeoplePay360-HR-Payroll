import * as React from 'react'
import { Lock } from 'lucide-react'
import { usePermission } from '@/auth/AuthProvider'
import { Card } from './primitives'

export function PermissionGate({ permission, children, fallback = null }: { permission: string | string[]; children: React.ReactNode; fallback?: React.ReactNode }) {
  const { can } = usePermission()
  const codes = Array.isArray(permission) ? permission : [permission]
  return <>{codes.some(can) ? children : fallback}</>
}

export function NotPermitted({ requiredPermission, detail }: { requiredPermission?: string; detail?: string }) {
  return (
    <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
      <Lock className="mx-auto mb-3 h-6 w-6 text-label2" />
      <h2 className="text-[17px] font-semibold">Not permitted</h2>
      <p className="mt-1 text-sm2 text-label2">{detail ?? 'Your role does not include access to this screen.'}</p>
      {requiredPermission ? (
        <p className="mt-3 inline-block rounded-full bg-surface2 px-3 py-1 text-xs2 text-label2">
          Requires <span className="font-semibold text-label">{requiredPermission}</span>
        </p>
      ) : null}
    </Card>
  )
}
