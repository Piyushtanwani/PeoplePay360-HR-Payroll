export interface ProblemDetail {
  type?: string
  title?: string
  status: number
  detail?: string
  code?: string
  requiredPermission?: string
  requestId?: string
  errors?: { field: string; message: string }[]
}

export class ApiError extends Error {
  status: number
  code: string
  detail: string
  requiredPermission?: string
  requestId?: string
  errors: { field: string; message: string }[]
  retryAfter?: number

  constructor(problem: ProblemDetail, retryAfter?: number) {
    super(problem.detail || problem.title || `Request failed (${problem.status})`)
    this.name = 'ApiError'
    this.status = problem.status
    this.code = problem.code ?? 'UNKNOWN'
    this.detail = problem.detail ?? problem.title ?? 'Something went wrong.'
    this.requiredPermission = problem.requiredPermission
    this.requestId = problem.requestId
    this.errors = problem.errors ?? []
    this.retryAfter = retryAfter
  }
}

const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

/** POST endpoints that change money or state accept an Idempotency-Key (B3). */
const IDEMPOTENT_SUFFIXES = ['/compute', '/validate', '/pay', '/send', '/convert', '/approve', '/refuse']

let tokenGetter: () => string | null = () => null
let onUnauthenticated: () => void = () => {}

export function configureClient(opts: { getToken: () => string | null; onUnauthenticated: () => void }) {
  tokenGetter = opts.getToken
  onUnauthenticated = opts.onUnauthenticated
}

function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | null | undefined>
  headers?: Record<string, string>
  idempotencyKey?: string
  raw?: boolean
}

export function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = `${BASE}${path}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue
    params.set(k, String(v))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, headers = {}, idempotencyKey, raw } = options
  const requestId = uuid()
  const token = tokenGetter()

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    'X-Request-Id': requestId,
    ...headers,
  }
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json'
  if (token) finalHeaders.Authorization = `Bearer ${token}`
  if (method === 'POST' && IDEMPOTENT_SUFFIXES.some((s) => path.endsWith(s))) {
    finalHeaders['Idempotency-Key'] = idempotencyKey ?? uuid()
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 401) {
    onUnauthenticated()
  }

  if (!response.ok) {
    const retryAfterHeader = response.headers.get('Retry-After')
    let problem: ProblemDetail = { status: response.status, title: response.statusText }
    try {
      const parsed = await response.json()
      problem = { ...parsed, status: parsed.status ?? response.status }
    } catch {
      /* non-JSON error body */
    }
    problem.requestId = problem.requestId ?? response.headers.get('X-Request-Id') ?? requestId
    throw new ApiError(problem, retryAfterHeader ? Number(retryAfterHeader) : undefined)
  }

  if (raw) return response as unknown as T
  if (response.status === 204) return undefined as T
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export interface PageLike<T> { content: T[]; page: number; size: number; totalElements: number; totalPages: number }

/** Several backend list endpoints return a bare array rather than a page envelope. */
export function toPage<T>(data: T[] | PageLike<T> | undefined | null): PageLike<T> {
  if (Array.isArray(data)) return { content: data, page: 0, size: data.length, totalElements: data.length, totalPages: 1 }
  if (!data) return { content: [], page: 0, size: 0, totalElements: 0, totalPages: 0 }
  return data
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], headers?: Record<string, string>) =>
    request<T>(path, { method: 'GET', query, headers }),
  page: <T>(path: string, query?: RequestOptions['query']) =>
    request<T[] | PageLike<T>>(path, { method: 'GET', query }).then((data) => toPage<T>(data)),
  post: <T>(path: string, body?: unknown, query?: RequestOptions['query']) =>
    request<T>(path, { method: 'POST', body, query }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  raw: (path: string, query?: RequestOptions['query']) => request<Response>(path, { query, raw: true }),
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.detail
  if (error instanceof Error) return error.message
  return 'Unexpected error.'
}
