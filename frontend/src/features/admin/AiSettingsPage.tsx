import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Star, Zap } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import {
  Button, Callout, Card, CardHeader, Chip, Field, PageHeader, SegmentedControl, Select, Sheet,
  TextInput, Toggle, useToast,
} from '@/components/ui'
import { fmtDateTime } from '@/lib/format'
import type { AiModel, AiProfile, AiProviderPreset } from '@/api/types'

export function AiSettingsPage() {
  const [editing, setEditing] = React.useState<AiProfile | 'new' | null>(null)
  const queryClient = useQueryClient()
  const toast = useToast()

  const profiles = useQuery({ queryKey: ['admin', 'ai', 'profiles'], queryFn: () => api.get<AiProfile[]>('/api/admin/ai/profiles') })

  const setDefault = useMutation({
    mutationFn: (id: number) => api.post(`/api/admin/ai/profiles/${id}/default`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'ai'] }); toast.push({ tone: 'success', title: 'Default profile updated' }) },
  })

  const test = useMutation({
    mutationFn: (id: number) => api.post<AiProfile>(`/api/admin/ai/profiles/${id}/test`),
    onSuccess: (profile) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai'] })
      toast.push({ tone: profile.lastTestOk ? 'success' : 'error', title: profile.lastTestOk ? 'Connection succeeded' : 'Connection failed', detail: profile.lastTestMessage ?? '' })
    },
  })

  return (
    <>
      <PageHeader
        title="AI settings"
        description="Provider profiles used by the assistant. The MCP service is not reachable while the backend is disconnected."
        actions={<Button variant="primary" onClick={() => setEditing('new')}>New profile</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {(profiles.data ?? []).map((profile) => (
          <Card key={profile.id}>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  {profile.name}
                  {profile.isDefault ? <Chip tone="accent"><Star className="h-3 w-3" /> default</Chip> : null}
                </span>
              }
              subtitle={`${profile.provider.toLowerCase()} · ${profile.model}`}
              action={<Button size="sm" onClick={() => setEditing(profile)}>Edit</Button>}
            />
            <dl className="divide-y divide-separator">
              {[
                ['Base URL', profile.baseUrl],
                ['Tool mode', profile.toolMode.toLowerCase()],
                ['Temperature', String(profile.temperature)],
                ['Max tokens', String(profile.maxTokens)],
                ['API key', profile.apiKeySet ? `stored ····${profile.apiKeyLast4}` : 'not required'],
                ['Last test', profile.lastTestAt ? `${profile.lastTestMessage} · ${fmtDateTime(profile.lastTestAt)}` : 'never tested'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 px-5 py-2 text-sm2">
                  <dt className="text-label2">{label}</dt><dd className="truncate text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex gap-2 border-t border-separator px-5 py-3">
              <Button size="sm" icon={<Zap className="h-3.5 w-3.5" />} loading={test.isPending} onClick={() => test.mutate(profile.id)}>Test connection</Button>
              {!profile.isDefault ? <Button size="sm" onClick={() => setDefault.mutate(profile.id)}>Set as default</Button> : null}
            </div>
          </Card>
        ))}
      </div>

      {editing ? <ProfileSheet profile={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </>
  )
}

function ProfileSheet({ profile, onClose }: { profile: AiProfile | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const providers = useQuery({ queryKey: ['admin', 'ai', 'providers'], queryFn: () => api.get<AiProviderPreset[]>('/api/admin/ai/providers') })

  const [form, setForm] = React.useState({
    name: profile?.name ?? '', provider: profile?.provider ?? 'OLLAMA', baseUrl: profile?.baseUrl ?? '',
    model: profile?.model ?? '', apiKey: '', toolMode: profile?.toolMode ?? 'AUTO',
    temperature: profile?.temperature ?? 0.2, maxTokens: profile?.maxTokens ?? 2048, manualModel: false,
  })
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))
  const preset = providers.data?.find((p) => p.provider === form.provider)

  const models = useQuery({
    queryKey: ['admin', 'ai', 'models', form.provider, form.baseUrl],
    enabled: Boolean(form.baseUrl),
    queryFn: () => api.post<AiModel[]>('/api/admin/ai/models', { provider: form.provider, baseUrl: form.baseUrl, profileId: profile?.id }),
  })

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, apiKey: form.apiKey || undefined }
      return profile ? api.put<AiProfile>(`/api/admin/ai/profiles/${profile.id}`, body) : api.post<AiProfile>('/api/admin/ai/profiles', body)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'ai'] }); onClose(); toast.push({ tone: 'success', title: 'AI profile saved' }) },
    onError: (error) => toast.push({ tone: 'error', title: 'Could not save profile', detail: error instanceof ApiError ? error.detail : '' }),
  })

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && onClose()}
      width="lg"
      title={profile ? `Edit ${profile.name}` : 'New AI profile'}
      description="These settings are used by the assistant when the MCP service is connected."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={!form.name || !form.model} onClick={() => save.mutate()}>Save profile</Button></>}
    >
      <div className="space-y-4">
        <Field label="Profile name" required><TextInput value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Local Ollama" /></Field>

        <Field label="Provider" required>
          <Select
            value={form.provider}
            onChange={(value) => {
              const next = providers.data?.find((p) => p.provider === value)
              setForm((f) => ({ ...f, provider: value, baseUrl: next?.defaultBaseUrl ?? f.baseUrl, model: '' }))
            }}
            options={(providers.data ?? []).map((p) => ({ value: p.provider, label: p.label, description: p.defaultBaseUrl }))}
          />
        </Field>

        <Field label="Base URL" required hint={preset ? `Default: ${preset.defaultBaseUrl}` : undefined}>
          <div className="flex gap-2">
            <TextInput value={form.baseUrl} onChange={(e) => set('baseUrl', e.target.value)} />
            {preset ? <Button onClick={() => set('baseUrl', preset.defaultBaseUrl)}>Reset</Button> : null}
          </div>
        </Field>

        {preset?.requiresApiKey ? (
          <Field label="API key" hint={profile?.apiKeySet ? 'Leave blank to keep the stored key.' : undefined}>
            <TextInput type="password" value={form.apiKey} onChange={(e) => set('apiKey', e.target.value)} placeholder="sk-…" />
          </Field>
        ) : null}

        <Field label="Model" required hint={models.isError ? 'Model listing failed — enter the model name manually.' : undefined}>
          {form.manualModel || models.isError ? (
            <TextInput value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="llama3.1:8b" />
          ) : (
            <Select
              value={form.model || null}
              onChange={(value) => set('model', String(value))}
              loading={models.isLoading}
              placeholder="Select a model"
              options={(models.data ?? []).map((m) => ({
                value: m.id, label: m.name,
                description: `${m.supportsTools === null ? 'Tool support unknown' : m.supportsTools ? 'Tools supported' : 'No tool support'}${m.contextLength ? ` · ${(m.contextLength / 1000).toFixed(0)}k context` : ''}`,
              }))}
              createLabel="Enter model name manually"
              onCreate={() => set('manualModel', true)}
            />
          )}
        </Field>

        <Field label="Tool mode" hint="Auto lets the provider decide how tools are invoked.">
          <SegmentedControl value={form.toolMode} onChange={(v) => set('toolMode', v)} options={[{ value: 'AUTO', label: 'Auto' }, { value: 'NATIVE', label: 'Native' }, { value: 'PROMPTED', label: 'Prompted' }]} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Temperature — ${form.temperature.toFixed(1)}`}>
            <input type="range" min={0} max={1} step={0.1} value={form.temperature} onChange={(e) => set('temperature', Number(e.target.value))} className="w-full accent-[var(--accent)]" />
          </Field>
          <Field label="Max tokens">
            <Select value={form.maxTokens} onChange={(v) => set('maxTokens', v)} options={[512, 1024, 2048, 4096].map((n) => ({ value: n, label: String(n) }))} />
          </Field>
        </div>

        {form.provider === 'OLLAMA' ? (
          <Callout tone="neutral" title="Ollama runs on your machine">
            Start it locally and pull a model first: <span className="font-mono">ollama pull llama3.1:8b</span>
          </Callout>
        ) : null}
      </div>
    </Sheet>
  )
}
