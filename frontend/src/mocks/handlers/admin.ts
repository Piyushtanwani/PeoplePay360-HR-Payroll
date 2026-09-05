import { http, HttpResponse } from 'msw'
import * as db from '../data/seed'
import { guard, nextId, ok, page, problem } from '../helpers'
import { ADMIN_TIER, ALL_PERMISSIONS, NEVER_GRANTABLE, describe, parsePermission } from '@/auth/permissions'
import type { AiProfile, Grant } from '@/api/types'

export const adminHandlers = [
  http.get('/api/admin/users', ({ request }) =>
    guard(request, 'user.read', () => {
      const url = new URL(request.url)
      const q = (url.searchParams.get('q') ?? '').toLowerCase()
      const rows = db.adminUsers.filter((u) => !q || `${u.displayName} ${u.email}`.toLowerCase().includes(q))
      return ok(page(rows, url))
    }),
  ),

  http.get('/api/admin/permissions', ({ request }) =>
    guard(request, 'user.read', (c) =>
      ok(
        ALL_PERMISSIONS.map((code) => {
          const { resource, action, scope } = parsePermission(code)
          const tier = ADMIN_TIER.has(code) ? 'ADMIN' : 'STANDARD'
          return {
            code, resource, action, scope, tier, description: describe(code),
            grantableByMe: !NEVER_GRANTABLE.has(code) && c.permissions.has(code) && (tier !== 'ADMIN' || c.roleCode === 'ADMIN'),
          }
        }),
      ),
    ),
  ),

  http.get('/api/admin/users/:id/permissions', ({ request, params }) =>
    guard(request, 'user.read', () => {
      const user = db.adminUsers.find((u) => u.id === Number(params.id))
      if (!user) return problem(404, 'NOT_FOUND', 'User not found.')
      return ok({
        effective: db.permissionsFor(user.id, user.roleCode),
        fromRole: db.permissionsFor(user.id, user.roleCode).filter((p) => !db.grants.some((g) => g.userId === user.id && g.active && g.permissionCode === p)),
        grants: db.grants.filter((g) => g.userId === user.id),
      })
    }),
  ),

  http.post('/api/admin/users/:id/grants', ({ request, params }) =>
    guard(request, 'permission.grant', async (c) => {
      const userId = Number(params.id)
      if (userId === c.userId) return problem(403, 'SELF_ACTION', 'You cannot grant permissions to yourself.')
      const body = (await request.json()) as { permissionCode: string; effect: 'ALLOW' | 'DENY'; reason: string; expiresAt?: string }
      if (NEVER_GRANTABLE.has(body.permissionCode)) return problem(403, 'PERMISSION_DENIED', 'This permission can never be granted.')
      if (!c.permissions.has(body.permissionCode)) return problem(403, 'PERMISSION_DENIED', 'You can only grant permissions you hold yourself.')
      const grant: Grant = {
        id: nextId(db.grants), userId, permissionCode: body.permissionCode, effect: body.effect, reason: body.reason,
        grantedBy: c.userId, grantedByName: c.displayName, grantedAt: new Date().toISOString(),
        expiresAt: body.expiresAt ?? null, revokedAt: null, active: true,
      }
      db.grants.push(grant)
      const user = db.adminUsers.find((u) => u.id === userId)
      if (user) user.grantCount += 1
      return ok(grant, { status: 201 })
    }),
  ),

  http.delete('/api/admin/grants/:grantId', ({ request, params }) =>
    guard(request, 'permission.grant', () => {
      const grant = db.grants.find((g) => g.id === Number(params.grantId))
      if (!grant) return problem(404, 'NOT_FOUND', 'Grant not found.')
      grant.active = false
      grant.revokedAt = new Date().toISOString()
      const user = db.adminUsers.find((u) => u.id === grant.userId)
      if (user) user.grantCount = Math.max(0, user.grantCount - 1)
      return new Response(null, { status: 204 })
    }),
  ),

  http.post('/api/admin/users/:id/role', ({ request, params }) =>
    guard(request, 'role.assign', async (c) => {
      const user = db.adminUsers.find((u) => u.id === Number(params.id))
      if (!user) return problem(404, 'NOT_FOUND', 'User not found.')
      const body = (await request.json()) as { roleCode: typeof user.roleCode }
      if (user.id === c.userId && body.roleCode !== 'ADMIN') {
        return problem(409, 'ILLEGAL_STATE', 'You cannot remove your own administrator role.')
      }
      user.roleCode = body.roleCode
      const account = db.demoAccounts.find((a) => a.id === user.id)
      if (account) account.roleCode = body.roleCode
      return ok(user)
    }),
  ),

  http.get('/api/admin/audit', ({ request }) =>
    guard(request, 'audit.read', () => {
      const url = new URL(request.url)
      const channel = url.searchParams.get('channel')
      const outcome = url.searchParams.get('outcome')
      const actorUserId = url.searchParams.get('actorUserId')
      const resourceType = url.searchParams.get('resourceType')
      const q = (url.searchParams.get('q') ?? '').toLowerCase()
      let rows = db.auditEvents
      if (channel) rows = rows.filter((e) => e.channel === channel)
      if (outcome) rows = rows.filter((e) => e.outcome === outcome)
      if (actorUserId) rows = rows.filter((e) => e.actorUserId === Number(actorUserId))
      if (resourceType) rows = rows.filter((e) => e.resourceType === resourceType)
      if (q) rows = rows.filter((e) => `${e.action} ${e.actorName} ${e.resourceType}`.toLowerCase().includes(q))
      return ok(page(rows, url))
    }),
  ),

  http.get('/api/admin/audit/export.csv', ({ request }) =>
    guard(request, 'audit.export', () => {
      const header = 'occurredAt,actor,channel,action,resourceType,resourceId,outcome\n'
      const body = db.auditEvents
        .map((e) => [e.occurredAt, e.actorName, e.channel, e.action, e.resourceType, e.resourceId, e.outcome].join(','))
        .join('\n')
      return new HttpResponse(header + body, {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="audit.csv"' },
      })
    }),
  ),

  http.get('/api/admin/ai/providers', ({ request }) =>
    guard(request, 'ai.settings', () =>
      ok([
        { provider: 'OLLAMA', label: 'Ollama (local)', defaultBaseUrl: 'http://localhost:11434/v1', requiresApiKey: false, docsUrl: 'https://ollama.com' },
        { provider: 'OPENROUTER', label: 'OpenRouter', defaultBaseUrl: 'https://openrouter.ai/api/v1', requiresApiKey: true, docsUrl: 'https://openrouter.ai/docs' },
        { provider: 'NVIDIA', label: 'NVIDIA NIM', defaultBaseUrl: 'https://integrate.api.nvidia.com/v1', requiresApiKey: true, docsUrl: 'https://build.nvidia.com' },
      ]),
    ),
  ),

  http.get('/api/admin/ai/profiles', ({ request }) => guard(request, 'ai.settings', () => ok(db.aiProfiles))),

  http.post('/api/admin/ai/models', ({ request }) =>
    guard(request, 'ai.settings', async () => {
      const body = (await request.json()) as { provider: string }
      const catalogue: Record<string, { id: string; name: string; supportsTools: boolean | null; contextLength: number | null }[]> = {
        OLLAMA: [
          { id: 'llama3.1:8b', name: 'Llama 3.1 8B', supportsTools: true, contextLength: 131072 },
          { id: 'qwen2.5:7b', name: 'Qwen 2.5 7B', supportsTools: true, contextLength: 32768 },
          { id: 'mistral:7b', name: 'Mistral 7B', supportsTools: null, contextLength: 32768 },
        ],
        OPENROUTER: [
          { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B Instruct', supportsTools: true, contextLength: 131072 },
          { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', supportsTools: true, contextLength: 200000 },
        ],
        NVIDIA: [{ id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B', supportsTools: true, contextLength: 128000 }],
      }
      return ok(catalogue[body.provider] ?? [])
    }),
  ),

  http.post('/api/admin/ai/profiles', ({ request }) =>
    guard(request, 'ai.settings', async () => {
      const body = (await request.json()) as Partial<AiProfile> & { apiKey?: string }
      const profile: AiProfile = {
        id: nextId(db.aiProfiles), name: body.name ?? 'New profile', provider: body.provider ?? 'OLLAMA',
        baseUrl: body.baseUrl ?? '', model: body.model ?? '', apiKeySet: Boolean(body.apiKey),
        apiKeyLast4: body.apiKey ? body.apiKey.slice(-4) : null, toolMode: body.toolMode ?? 'AUTO',
        temperature: body.temperature ?? 0.2, maxTokens: body.maxTokens ?? 2048, isDefault: false,
        updatedAt: new Date().toISOString(), lastTestOk: null, lastTestAt: null, lastTestMessage: null,
      }
      db.aiProfiles.push(profile)
      return ok(profile, { status: 201 })
    }),
  ),

  http.put('/api/admin/ai/profiles/:id', ({ request, params }) =>
    guard(request, 'ai.settings', async () => {
      const profile = db.aiProfiles.find((p) => p.id === Number(params.id))
      if (!profile) return problem(404, 'NOT_FOUND', 'AI profile not found.')
      const body = (await request.json()) as Partial<AiProfile> & { apiKey?: string }
      const { apiKey, ...rest } = body
      Object.assign(profile, rest)
      if (apiKey) {
        profile.apiKeySet = true
        profile.apiKeyLast4 = apiKey.slice(-4)
      }
      profile.updatedAt = new Date().toISOString()
      return ok(profile)
    }),
  ),

  http.post('/api/admin/ai/profiles/:id/default', ({ request, params }) =>
    guard(request, 'ai.settings', () => {
      for (const p of db.aiProfiles) p.isDefault = p.id === Number(params.id)
      return ok(db.aiProfiles.find((p) => p.id === Number(params.id)))
    }),
  ),

  http.post('/api/admin/ai/profiles/:id/test', ({ request, params }) =>
    guard(request, 'ai.settings', () => {
      const profile = db.aiProfiles.find((p) => p.id === Number(params.id))
      if (!profile) return problem(404, 'NOT_FOUND', 'AI profile not found.')
      const okTest = profile.provider !== 'NVIDIA'
      profile.lastTestOk = okTest
      profile.lastTestAt = new Date().toISOString()
      profile.lastTestMessage = okTest ? `Connected in ${180 + profile.id * 37} ms` : 'No API key configured for this provider.'
      return ok(profile)
    }),
  ),

  http.delete('/api/admin/ai/profiles/:id', ({ request, params }) =>
    guard(request, 'ai.settings', () => {
      const index = db.aiProfiles.findIndex((p) => p.id === Number(params.id))
      if (index < 0) return problem(404, 'NOT_FOUND', 'AI profile not found.')
      db.aiProfiles.splice(index, 1)
      return new Response(null, { status: 204 })
    }),
  ),

  http.get('/api/admin/health', ({ request }) =>
    guard(request, null, () =>
      ok([
        { name: 'Database', status: 'UP', detail: 'PostgreSQL 16 · peoplepay', latencyMs: 4 },
        { name: 'Mail', status: 'UP', detail: 'Mailpit on localhost:1025', latencyMs: 11 },
        { name: 'MCP service', status: 'DOWN', detail: 'Not reachable — the backend is not connected in mock mode', latencyMs: null },
        { name: 'AI profile', status: 'DEGRADED', detail: 'Local Ollama · llama3.1:8b (untested this session)', latencyMs: null },
      ]),
    ),
  ),
]
