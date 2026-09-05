import { useRouteError, useNavigate } from 'react-router-dom'
import { ApiError } from '@/api/client'
import { Button, Card } from '@/components/ui'

export function RouteError() {
  const error = useRouteError()
  const navigate = useNavigate()
  const apiError = error instanceof ApiError ? error : null
  return (
    <div className="p-8">
      <Card className="mx-auto max-w-lg p-8 text-center">
        <h2 className="text-[17px] font-semibold">Something went wrong</h2>
        <p className="mt-1 text-sm2 text-label2">{apiError?.detail ?? (error as Error)?.message ?? 'This screen failed to load.'}</p>
        {apiError?.requestId ? <p className="tnum mt-2 text-xs2 text-label2">requestId {apiError.requestId}</p> : null}
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={() => navigate(-1)}>Go back</Button>
          <Button variant="primary" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </Card>
    </div>
  )
}
