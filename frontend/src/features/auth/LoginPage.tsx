import * as React from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import { ApiError } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import { Button, Callout, Card, Field, Select, TextInput } from '@/components/ui'

const DEMO_ACCOUNTS = [
  { value: 'admin@peoplepay.local', label: 'Taylor Brooks — Administrator', description: 'Full access including users, audit and AI settings', password: 'Admin@12345' },
  { value: 'payroll.manager@peoplepay.local', label: 'Riley Chen — HR Payroll Manager', description: 'Can pay, override issues and edit salary structures', password: 'Manager@12345' },
  { value: 'payroll@peoplepay.local', label: 'Jordan Lee — HR Payroll User', description: 'Computes and validates payruns; no pay permission', password: 'Payroll@12345' },
  { value: 'hr@peoplepay.local', label: 'Morgan Diaz — HR Manager', description: 'People and time modules; no payroll figures', password: 'Hr@12345' },
  { value: 'employee@peoplepay.local', label: 'Sam Patel — Employee', description: 'Self-service only, plus a granted assistant permission', password: 'Employee@12345' },
]

export function LoginPage() {
  const { login, token, me, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  if (!loading && token && me) return <Navigate to={location.state?.from ?? '/'} replace />

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
      navigate(location.state?.from ?? '/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Sign in failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-[11px] bg-accent text-white">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-d3 font-semibold tracking-[-0.01em]">PeoplePay360</h1>
            <p className="text-sm2 text-label2">Sign in to continue to your workspace.</p>
          </div>
        </div>

        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Try as" hint="Demo profile — picking an account fills the form below.">
              <Select
                value={email || null}
                onChange={(value) => {
                  const account = DEMO_ACCOUNTS.find((a) => a.value === value)!
                  setEmail(account.value)
                  setPassword(account.password)
                }}
                options={DEMO_ACCOUNTS}
                placeholder="Choose a demo account…"
              />
            </Field>

            <Field label="Work email" htmlFor="email" required>
              <TextInput id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" required />
            </Field>

            <Field label="Password" htmlFor="password" required>
              <TextInput id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" required />
            </Field>

            {error ? <Callout tone="bad">{error}</Callout> : null}

            <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
              Sign in
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-xs2 text-label2">
          Accounts are created by an administrator. After sign-in only the modules allowed by your role are shown.
        </p>
      </div>
    </div>
  )
}
