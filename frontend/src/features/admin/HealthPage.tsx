import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Card, PageHeader, StatusBadge } from '@/components/ui'
import type { HealthCard } from '@/api/types'

interface BackendHealth {
  db: boolean
  mail: boolean
  mcp: { reachable: boolean; version: string }
  ai: { profile: string; lastTestOk: boolean }
}

function toCards(h: BackendHealth): HealthCard[] {
  return [
    { name: 'Database', status: h.db ? 'UP' : 'DOWN', detail: h.db ? 'PostgreSQL reachable' : 'PostgreSQL unreachable', latencyMs: null },
    { name: 'Mail', status: h.mail ? 'UP' : 'DOWN', detail: h.mail ? 'SMTP transport configured' : 'SMTP transport unavailable', latencyMs: null },
    {
      name: 'MCP service', status: h.mcp.reachable ? 'UP' : 'DEGRADED',
      detail: h.mcp.reachable ? `Version ${h.mcp.version}` : 'Not reachable. Chat tools are unavailable until it starts.', latencyMs: null,
    },
    {
      name: 'AI provider', status: h.ai.lastTestOk ? 'UP' : 'DEGRADED',
      detail: h.ai.profile === 'none' ? 'No default profile configured' : `Profile ${h.ai.profile}${h.ai.lastTestOk ? '' : '. Last connection test failed'}`,
      latencyMs: null,
    },
  ]
}

export function HealthPage() {
  const query = useQuery({
    queryKey: ['admin', 'health'],
    queryFn: () => api.get<BackendHealth>('/api/admin/health').then(toCards),
    refetchInterval: 20_000,
  })

  return (
    <>
      <PageHeader title="Health" description="Service checks for the parts of the stack this frontend depends on." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(query.data ?? []).map((card) => (
          <Card key={card.name} className="p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{card.name}</p>
              <StatusBadge status={card.status} />
            </div>
            <p className="mt-2 text-sm2 text-label2">{card.detail}</p>
            {card.latencyMs !== null ? <p className="tnum mt-1 text-xs2 text-label2">{card.latencyMs} ms</p> : null}
          </Card>
        ))}
      </div>
    </>
  )
}
