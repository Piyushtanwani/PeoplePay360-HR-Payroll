import { http } from 'msw'
import * as db from '../data/seed'
import { caller, guard, ok, problem } from '../helpers'
import type { MeResponse } from '@/api/types'

function meFor(userId: number): MeResponse {
  const account = db.demoAccounts.find((a) => a.id === userId)!
  const permissions = db.permissionsFor(account.id, account.roleCode)
  const employee = db.employees.find((e) => e.id === account.employeeId) ?? null
  return {
    user: { id: account.id, email: account.email, displayName: account.displayName, roleCode: account.roleCode, employeeId: account.employeeId, active: true },
    permissions,
    employee,
    settings: { currency: 'INR', timezone: 'Asia/Kolkata', appName: 'PeoplePay360', profile: 'demo' },
    features: { chat: permissions.includes('chat.access'), recruitment: permissions.includes('candidate.read') },
  }
}

export const authHandlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string }
    const account = db.demoAccounts.find((a) => a.email.toLowerCase() === email?.toLowerCase())
    if (!account || account.password !== password) {
      return problem(401, 'UNAUTHENTICATED', 'Email or password is incorrect.')
    }
    const me = meFor(account.id)
    return ok({ accessToken: `mock.${account.id}.token`, expiresIn: 43200, tokenType: 'Bearer', user: me.user })
  }),

  http.get('/api/auth/me', ({ request }) => {
    const c = caller(request)
    if (!c) return problem(401, 'UNAUTHENTICATED', 'Your session has expired. Please sign in again.')
    return ok(meFor(c.userId))
  }),

  http.post('/api/auth/logout', () => new Response(null, { status: 204 })),

  http.post('/api/auth/demo-switch', ({ request }) =>
    guard(request, 'seed.manage', async () => {
      const { email } = (await request.json()) as { email: string }
      const account = db.demoAccounts.find((a) => a.email === email)
      if (!account) return problem(404, 'NOT_FOUND', 'Demo account not found.')
      return ok({ accessToken: `mock.${account.id}.token`, expiresIn: 43200, tokenType: 'Bearer', user: meFor(account.id).user })
    }),
  ),
]
