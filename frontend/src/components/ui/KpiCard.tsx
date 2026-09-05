import * as React from 'react'
import { cn } from '@/lib/cn'
import { Card, Skeleton } from './primitives'

export function KpiCard({ label, value, caption, delta, tone = 'neutral', loading }: {
  label: string
  value: React.ReactNode
  caption?: React.ReactNode
  delta?: number | null
  tone?: 'neutral' | 'ok' | 'warn' | 'bad'
  loading?: boolean
}) {
  const tones = { neutral: 'text-label', ok: 'text-ok', warn: 'text-warn', bad: 'text-bad' }
  return (
    <Card className="p-4">
      <p className="text-sm2 text-label2">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-28" />
      ) : (
        <p className={cn('tnum mt-1 text-d2 font-semibold tracking-[-0.02em]', tones[tone])}>{value}</p>
      )}
      <div className="mt-1 flex items-center gap-2 text-xs2 text-label2">
        {delta !== undefined && delta !== null ? (
          <span className={cn('tnum font-medium', delta >= 0 ? 'text-ok' : 'text-bad')}>
            {delta >= 0 ? '+' : ''}
            {delta.toFixed(1)}%
          </span>
        ) : null}
        {caption}
      </div>
    </Card>
  )
}
