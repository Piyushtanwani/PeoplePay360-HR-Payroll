import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Cpu, ExternalLink, Hammer, Loader2, Server, Sparkles, Zap } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { Button, Callout, Card, Chip, PageHeader, Select, TextInput, useToast } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { AiProfile, AiProviderPreset, QuickSetupResult } from '@/api/types'

const BLURB: Record<string, string> = {
  OPENROUTER: 'One key, many hosted models from a single account.',
  NVIDIA: 'NVIDIA-hosted models. Paste a build.nvidia.com key to begin.',
  OLLAMA: 'Runs on this machine. No key needed — just make sure Ollama is running.',
}

const ICON: Record<string, React.ReactNode> = {
  OPENROUTER: <Sparkles className="h-4 w-4" />,
  NVIDIA: <Cpu className="h-4 w-4" />,
  OLLAMA: <Server className="h-4 w-4" />,
}

export function AiSettingsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [provider, setProvider] = React.useState<string>('OLLAMA')
  const [apiKey, setApiKey] = React.useState('')
  const [models, setModels] = React.useState<string[]>([])
  const [model, setModel] = React.useState<string | null>(null)

  /** Switching provider invalidates any list already fetched. */
  const pickProvider = (next: string) => {
    setProvider(next)
    setApiKey('')
    setModels([])
    setModel(null)
  }

  const providers = useQuery({
    queryKey: ['admin', 'ai', 'providers'],
    queryFn: () => api.get<AiProviderPreset[]>('/api/admin/ai/providers'),
  })
  const profiles = useQuery({
    queryKey: ['admin', 'ai', 'profiles'],
    queryFn: () => api.get<AiProfile[]>('/api/admin/ai/profiles'),
  })

  const preset = (providers.data ?? []).find((p) => p.provider === provider)
  const active = (profiles.data ?? []).find((p) => p.isDefault) ?? null

  const loadModels = useMutation({
    mutationFn: () => api.post<{ models: string[]; defaultModel: string | null }>('/api/admin/ai/models', { provider, apiKey }),
    onSuccess: (result) => {
      setModels(result.models)
      setModel(result.defaultModel)
      if (result.models.length === 0) {
        toast.push({ tone: 'error', title: 'No models available', detail: 'For Ollama, pull a model first.' })
      }
    },
    onError: (e) => toast.push({
      tone: 'error',
      title: 'Could not fetch models',
      detail: e instanceof ApiError ? e.detail : 'Unexpected error.',
    }),
  })

  const connect = useMutation({
    mutationFn: () => api.post<QuickSetupResult>('/api/admin/ai/quick-setup', { provider, apiKey, model }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai'] })
      queryClient.invalidateQueries({ queryKey: ['chat'] })
      setApiKey('')
      toast.push({
        tone: result.ok ? 'success' : 'error',
        title: result.ok ? `Connected to ${result.profile.model}` : 'Saved, but the test failed',
        detail: result.ok ? 'This provider is now active for everyone.' : result.message,
      })
    },
    onError: (e) => toast.push({
      tone: 'error',
      title: 'Could not connect',
      detail: e instanceof ApiError ? e.detail : 'Unexpected error.',
    }),
  })

  const test = useMutation({
    mutationFn: (p: AiProfile) => api.post<{ ok: boolean; message: string }>('/api/admin/ai/test', { provider: p.provider, profileId: p.id }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai'] })
      toast.push({ tone: r.ok ? 'success' : 'error', title: r.ok ? 'Connection healthy' : 'Connection failed', detail: r.message })
    },
  })

  const needsKey = preset?.requiresApiKey ?? false
  const canFetch = !needsKey || apiKey.trim().length > 0

  return (
    <>
      <PageHeader
        title="AI settings"
        description="Pick a provider, fetch its models and choose one. The assistant then becomes available to everyone."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="p-5">
          <p className="text-sm2 font-semibold">Connect a provider</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {(providers.data ?? []).map((p) => (
              <button
                key={p.provider}
                onClick={() => pickProvider(p.provider)}
                className={cn(
                  'rounded-card border p-3 text-left transition-colors',
                  provider === p.provider ? 'border-accent bg-accent/8' : 'border-separator bg-surface2/40 hover:bg-surface2',
                )}
              >
                <span className="flex items-center gap-2 font-medium">
                  <span className={cn(provider === p.provider ? 'text-accent' : 'text-label2')}>{ICON[p.provider]}</span>
                  {p.label}
                </span>
                <span className="mt-1 block text-xs2 text-label2">{BLURB[p.provider] ?? ''}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-4">
            {needsKey ? (
              <div>
                <label htmlFor="aikey" className="text-sm2 font-medium">API key</label>
                <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                  <TextInput
                    id="aikey"
                    type="password"
                    value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); setModels([]); setModel(null) }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && canFetch) loadModels.mutate() }}
                    placeholder={provider === 'OPENROUTER' ? 'sk-or-v1-…' : 'nvapi-…'}
                    className="flex-1 font-mono"
                  />
                  <Button loading={loadModels.isPending} disabled={!canFetch} onClick={() => loadModels.mutate()}>
                    Fetch models
                  </Button>
                </div>
                {preset?.docsUrl ? (
                  <a href={preset.docsUrl} target="_blank" rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs2 text-accent hover:underline">
                    Get a key <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <p className="flex-1 text-sm2 text-label2">
                  No key required. Ollama must be running at <span className="font-mono">{preset?.defaultBaseUrl}</span>.
                </p>
                <Button loading={loadModels.isPending} onClick={() => loadModels.mutate()}>Fetch models</Button>
              </div>
            )}

            {loadModels.isPending ? (
              <p className="flex items-center gap-2 text-sm2 text-label2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Asking the provider which models it offers…
              </p>
            ) : null}

            {models.length > 0 ? (
              <div className="rounded-card border border-separator bg-surface2/40 p-3.5">
                <label htmlFor="aimodel" className="text-sm2 font-medium">Model</label>
                <p className="mt-0.5 text-xs2 text-label2">
                  {models.length} available. The best match for chat is preselected.
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <div className="flex-1">
                    <Select
                      id="aimodel"
                      value={model}
                      onChange={setModel}
                      options={models.map((m) => ({ value: m, label: m }))}
                      placeholder="Select a model"
                    />
                  </div>
                  <Button variant="primary" loading={connect.isPending} disabled={!model} onClick={() => connect.mutate()}>
                    Connect
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-sm2 font-semibold">Active assistant</p>
            {active ? (
              <>
                <p className="mt-2 flex items-center gap-2 text-body font-medium">
                  <Check className="h-4 w-4 text-ok" /> {active.name}
                </p>
                <dl className="mt-3 space-y-1.5 text-sm2">
                  <div className="flex justify-between gap-3">
                    <dt className="text-label2">Model</dt>
                    <dd className="truncate font-mono text-xs2">{active.model}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-label2">API key</dt>
                    <dd>{active.apiKeySet ? `····${active.apiKeyLast4}` : 'not required'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-label2">Last check</dt>
                    <dd>{active.lastTestAt ? fmtDateTime(active.lastTestAt) : 'never'}</dd>
                  </div>
                </dl>
                <Button size="sm" className="mt-3 w-full" icon={<Zap className="h-3.5 w-3.5" />}
                  loading={test.isPending} onClick={() => test.mutate(active)}>
                  Test connection
                </Button>
              </>
            ) : (
              <p className="mt-2 text-sm2 text-label2">Nothing connected yet. Pick a provider to enable the assistant.</p>
            )}
          </Card>

          <Callout tone="neutral" title="Record lookups">
            <p className="mt-1 flex items-center gap-2 text-sm2 text-label2">
              <Hammer className="h-3.5 w-3.5 shrink-0" />
              The assistant answers from the model today. Letting it read live payroll and HR records arrives with the
              MCP tool service.
            </p>
            <Chip className="mt-2">Coming soon</Chip>
          </Callout>
        </div>
      </div>

      {(profiles.data ?? []).length > 1 ? (
        <Card className="mt-4 p-5">
          <p className="text-sm2 font-semibold">Other saved providers</p>
          <div className="mt-2 divide-y divide-separator">
            {(profiles.data ?? []).filter((p) => !p.isDefault).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm2">
                <span className="min-w-0">
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 truncate font-mono text-xs2 text-label2">{p.model}</span>
                </span>
                <Button size="sm" onClick={() => pickProvider(p.provider)}>Reconnect</Button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </>
  )
}
