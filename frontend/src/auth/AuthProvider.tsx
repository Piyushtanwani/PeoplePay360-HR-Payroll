import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, ApiError, configureClient } from '@/api/client'
import { setCurrency } from '@/lib/format'
import type { MeResponse, UserSummary } from '@/api/types'

interface AuthState {
  token: string | null
  me: MeResponse | null
  loading: boolean
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

  const clear = React.useCallback(() => {
    tokenRef.current = null
    sessionStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setMe(null)
    queryClient.clear()
  }, [queryClient])

  React.useEffect(() => {
    configureClient({ getToken: () => tokenRef.current, onUnauthenticated: clear })
  }, [clear])

  const loadMe = React.useCallback(async () => {
    try {
      const response = await api.get<MeResponse>('/api/auth/me')
      setMe(response)
      setCurrency(response.settings.currency)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) clear()
    } finally {
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
      setLoading(true)
      await loadMe()
    },
    [loadMe],
  )

  const logout = React.useCallback(() => {
    void api.post('/api/auth/logout').catch(() => {})
    clear()
  }, [clear])

  const permissions = React.useMemo(() => new Set(me?.permissions ?? []), [me])
  const value = React.useMemo<AuthState>(
    () => ({
      token,
      me,
      loading,
      permissions,
      can: (code: string) => permissions.has(code),
      canAny: (codes: string[]) => codes.some((c) => permissions.has(c)),
      login,
      logout,
      refresh: loadMe,
      user: me?.user ?? null,
      employeeId: me?.user.employeeId ?? null,
    }),
    [token, me, loading, permissions, login, logout, loadMe],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

export function usePermission() {
  const { can, canAny, permissions } = useAuth()
  return { can, canAny, permissions }
}
