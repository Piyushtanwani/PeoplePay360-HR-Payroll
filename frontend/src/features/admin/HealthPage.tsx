import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Card, PageHeader, StatusBadge } from '@/components/ui'
import type { HealthCard } from '@/api/types'

export function HealthPage() {
  const query = useQuery({ queryKey: ['admin', 'health'], queryFn: () => api.get<HealthCard[]>('/api/admin/health'), refetchInterval: 20_000 })

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
      <p className="mt-4 text-sm2 text-label2">
        This build runs against an in-browser mock of the REST contract. Point <span className="font-mono">VITE_USE_MOCKS=false</span> at the
        Spring Boot backend to switch to live data.
      </p>
    </>
  )
}
