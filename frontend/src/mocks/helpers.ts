import { HttpResponse } from 'msw'
import * as db from './data/seed'
import { effectivePermissions } from '@/auth/permissions'
import type { RoleCode } from '@/api/types'

export interface Caller {
  userId: number
  employeeId: number
  roleCode: RoleCode
  displayName: string
  permissions: Set<string>
}

export function requestId() {
  return crypto.randomUUID()
}

export function problem(status: number, code: string, detail: string, extra: Record<string, unknown> = {}) {
  return HttpResponse.json(
    { type: 'about:blank', title: code, status, detail, code, requestId: requestId(), errors: [], ...extra },
    { status, headers: { 'Content-Type': 'application/problem+json', 'X-Request-Id': requestId() } },
  )
}

export function ok<T>(body: T, init: ResponseInit = {}) {
  return HttpResponse.json(body as any, { ...init, headers: { 'X-Request-Id': requestId(), ...(init.headers ?? {}) } })
}

export function caller(request: Request): Caller | null {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const userId = Number(auth.slice(7).split('.')[1])
  const account = db.demoAccounts.find((a) => a.id === userId)
  if (!account) return null
  return {
    userId: account.id,
    employeeId: account.employeeId,
    roleCode: account.roleCode,
    displayName: account.displayName,
    permissions: effectivePermissions(account.roleCode, db.grants.filter((g) => g.userId === account.id)),
  }
}

/** Wraps a handler with authentication and a permission check (B8). */
export function guard<T>(
  request: Request,
  permission: string | string[] | null,
  fn: (c: Caller) => T,
) {
  const c = caller(request)
  if (!c) return problem(401, 'UNAUTHENTICATED', 'Your session has expired. Please sign in again.')
  if (permission) {
    const needed = Array.isArray(permission) ? permission : [permission]
    const held = needed.some((p) => c.permissions.has(p))
    if (!held) {
      return problem(403, 'PERMISSION_DENIED', 'You do not have permission to perform this action.', {
        requiredPermission: c.permissions.has('user.read') || c.permissions.has('audit.read') ? needed[0] : undefined,
      })
    }
  }
  return fn(c)
}

export function page<T>(rows: T[], url: URL) {
  const page = Number(url.searchParams.get('page') ?? 0)
  const size = Math.min(Number(url.searchParams.get('size') ?? 25), 200)
  const start = page * size
  return {
    content: rows.slice(start, start + size),
    page,
    size,
    totalElements: rows.length,
    totalPages: Math.max(1, Math.ceil(rows.length / size)),
  }
}

/** `.own` scope resolution: `.all` sees everything, otherwise only the caller's own rows. */
export function scopeIds(c: Caller, allPermission: string) {
  return c.permissions.has(allPermission) ? null : c.employeeId
}

export function delay(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const nextId = (rows: { id: number }[]) => (rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1)
