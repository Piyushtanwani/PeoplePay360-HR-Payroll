import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, ApiError, configureClient } from '@/api/client'
import { setCurrency } from '@/lib/format'
import { setTimeZone } from '@/lib/dates'
import type { MeResponse, UserSummary } from '@/api/types'

interface AuthState {
  token: string | null
  me: MeResponse | null
  loading: boolean
  /** True when a previously valid session was rejected, so the login page can say so. */
  expired: boolean
  /** Set when the backend is unreachable; the session is kept, not discarded. */
  sessionError: string | null
  retry: () => void
  permissions: Set<string>
  can: (code: string) => boolean
  canAny: (codes: string[]) => boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
  user: UserSummary | null
  employeeId: number | null
}

const AuthContext = React.createContext<AuthState | null>(null)
const TOKEN_KEY = 'pp360.token'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const tokenRef = React.useRef<string | null>(sessionStorage.getItem(TOKEN_KEY))
  const [token, setToken] = React.useState<string | null>(tokenRef.current)
  const [me, setMe] = React.useState<MeResponse | null>(null)
  const [loading, setLoading] = React.useState(Boolean(tokenRef.current))
  const [expired, setExpired] = React.useState(false)
  const [sessionError, setSessionError] = React.useState<string | null>(null)

  const clear = React.useCallback(() => {
    tokenRef.current = null
    sessionStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setMe(null)
    // Deferred: a 401 can land mid-render, and clearing the cache synchronously
    // then tears down the very components still rendering from it.
    queueMicrotask(() => queryClient.clear())
  }, [queryClient])

  React.useEffect(() => {
    configureClient({ getToken: () => tokenRef.current, onUnauthenticated: clear })
  }, [clear])

  /**
   * Only a 401 means the session is gone. A network blip or a 5xx must not sign the
   * user out, so those retry briefly and otherwise surface as a recoverable error.
   */
  const loadMe = React.useCallback(async (attempt = 0): Promise<void> => {
    try {
      const response = await api.get<MeResponse>('/api/auth/me')
      setMe(response)
      setSessionError(null)
      setCurrency(response.settings.currency)
      // Timestamps are shown in the company timezone, so they match how the server classified them.
      setTimeZone(response.settings.timezone)
      setLoading(false)
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0
      if (status === 401) {
        setExpired(Boolean(tokenRef.current))
        clear()
        setLoading(false)
        return
      }
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
        return loadMe(attempt + 1)
      }
      // Keep the token: the session is probably fine, the backend is not reachable.
      setSessionError('Cannot reach the server. Check that the backend is running.')
      setLoading(false)
    }
  }, [clear])

  React.useEffect(() => {
    if (tokenRef.current) void loadMe()
    else setLoading(false)
  }, [loadMe])

  const login = React.useCallback(
    async (email: string, password: string) => {
      const response = await api.post<{ accessToken: string }>('/api/auth/login', { email, password })
      tokenRef.current = response.accessToken
      sessionStorage.setItem(TOKEN_KEY, response.accessToken)
      setToken(response.accessToken)
      setExpired(false)
      setSessionError(null)
      setLoading(true)
      await loadMe()
    },
    [loadMe],
  )

  const logout = React.useCallback(() => {
    void api.post('/api/auth/logout').catch(() => {})
    setExpired(false)
    setSessionError(null)
    clear()
  }, [clear])

  const retry = React.useCallback(() => {
    setSessionError(null)
    setLoading(true)
    void loadMe()
  }, [loadMe])

  const permissions = React.useMemo(() => new Set(me?.permissions ?? []), [me])
  const value = React.useMemo<AuthState>(
    () => ({
      token,
      me,
      loading,
      expired,
      sessionError,
      retry,
      permissions,
      can: (code: string) => permissions.has(code),
      canAny: (codes: string[]) => codes.some((c) => permissions.has(c)),
      login,
      logout,
      refresh: loadMe,
      user: me?.user ?? null,
      employeeId: me?.user.employeeId ?? null,
    }),
    [token, me, loading, expired, sessionError, retry, permissions, login, logout, loadMe],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/* eslint-disable-next-line react-refresh/only-export-components -- a context and its own hook belong in one file */
export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
