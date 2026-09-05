import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, buildUrl, configureClient, request } from './client'

/**
 * A fresh response per call. A Response body can only be read once, so a mock that returns the
 * same object twice fails on the second request for a reason that has nothing to do with the code.
 */
function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
}

/** The base URL comes from the environment, so paths are matched by suffix rather than in full. */
function pathOf(url: string) {
  return url.replace(/^https?:\/\/[^/]+/, '')
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  configureClient({ getToken: () => 'test-token', onUnauthenticated: () => {} })
})
afterEach(() => vi.unstubAllGlobals())

describe('buildUrl', () => {
  it('drops parameters the server should not receive at all', () => {
    expect(pathOf(buildUrl('/api/employees', { q: '', page: 0, active: undefined, dept: null }))).toBe('/api/employees?page=0')
  })

  it('repeats a key for an array, which is how a secondary sort is expressed', () => {
    expect(pathOf(buildUrl('/api/payslips', { sort: ['period,desc', 'employee,asc'] })))
      .toBe('/api/payslips?sort=period%2Cdesc&sort=employee%2Casc')
  })

  it('leaves a path alone when there is nothing to add', () => {
    expect(pathOf(buildUrl('/api/departments'))).toBe('/api/departments')
  })
})

describe('request', () => {
  it('sends the session token and a request id on every call', async () => {
    fetchMock.mockImplementation(jsonResponse({ ok: true }))
    await api.get('/api/me')
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer test-token')
    expect(headers['X-Request-Id']).toBeTruthy()
  })

  // Without this, a retried compute could pay a payrun twice.
  it('adds an idempotency key to the money-moving posts, and only those', async () => {
    fetchMock.mockImplementation(jsonResponse({}))
    await api.post('/api/payruns/1/pay')
    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>)['Idempotency-Key']).toBeTruthy()

    fetchMock.mockClear()
    await api.post('/api/departments', { name: 'Finance' })
    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>)['Idempotency-Key']).toBeUndefined()
  })

  it('turns a problem document into an error carrying the detail the user should read', async () => {
    fetchMock.mockImplementation(
      jsonResponse(
        { status: 400, code: 'VALIDATION', detail: 'Sort field "salary" is not sortable.', errors: [{ field: 'sort', message: 'unknown' }] },
        { status: 400 },
      ),
    )
    await expect(api.get('/api/employees')).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION',
      detail: 'Sort field "salary" is not sortable.',
      errors: [{ field: 'sort', message: 'unknown' }],
    })
  })

  it('keeps the permission a denial names, so the page can say which one is missing', async () => {
    fetchMock.mockImplementation(
      jsonResponse({ status: 403, code: 'FORBIDDEN', detail: 'Not permitted.', requiredPermission: 'payrun.export' }, { status: 403 }),
    )
    const error = await api.get('/api/payruns/1/export.csv').catch((e) => e as ApiError)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).requiredPermission).toBe('payrun.export')
  })

  it('still produces a readable error when the body is not a problem document', async () => {
    fetchMock.mockImplementation(() => new Response('<html>gateway timeout</html>', { status: 504, statusText: 'Gateway Timeout' }))
    const error = await api.get('/api/employees').catch((e) => e as ApiError)
    expect((error as ApiError).status).toBe(504)
    expect((error as ApiError).detail).toBe('Gateway Timeout')
    expect((error as ApiError).requestId).toBeTruthy()
  })

  it('reports how long to wait when the server rate limits', async () => {
    fetchMock.mockImplementation(
      () => new Response(JSON.stringify({ status: 429, code: 'RATE_LIMITED', detail: 'Too many requests.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '30' },
      }),
    )
    const error = await api.post('/api/auth/login').catch((e) => e as ApiError)
    expect((error as ApiError).retryAfter).toBe(30)
  })

  it('signs the session out exactly once when the token is rejected', async () => {
    const onUnauthenticated = vi.fn()
    configureClient({ getToken: () => 'stale', onUnauthenticated })
    fetchMock.mockImplementation(jsonResponse({ status: 401, code: 'UNAUTHENTICATED', detail: 'Session expired.' }, { status: 401 }))
    await api.get('/api/me').catch(() => {})
    expect(onUnauthenticated).toHaveBeenCalledTimes(1)
  })

  it('returns nothing for a delete that answers with no content', async () => {
    fetchMock.mockImplementation(() => new Response(null, { status: 204 }))
    await expect(api.del('/api/departments/1')).resolves.toBeUndefined()
  })

  it('hands back the raw response when the caller is downloading a file', async () => {
    fetchMock.mockImplementation(() => new Response('a,b\n1,2', { status: 200 }))
    const response = await request<Response>('/api/payruns/1/export.csv', { raw: true })
    expect(await response.text()).toBe('a,b\n1,2')
  })
})
