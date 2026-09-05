import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Check } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { Button, Callout, Card, Field, TextInput } from '@/components/ui'

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [sent, setSent] = React.useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post('/api/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Could not send the reset email. Please try again.')
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
            <p className="text-sm2 text-label2">Reset your password</p>
          </div>
        </div>

        <Card className="p-6">
          {sent ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-ok/12 text-ok">
                <Check className="h-5 w-5" />
              </div>
              <p className="font-medium">Check your inbox</p>
              <p className="mt-1 text-sm2 text-label2">
                If an account exists for {email}, a reset link is on its way. It works once and expires soon.
              </p>
              <Button className="mt-5 w-full" onClick={() => navigate('/login')}>Back to sign in</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <p className="text-sm2 text-label2">
                Enter your work email and we will send you a link to choose a new password.
              </p>
              <Field label="Work email" htmlFor="email" required>
                <TextInput id="email" type="email" autoComplete="username" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" required />
              </Field>
              {error ? <Callout tone="bad">{error}</Callout> : null}
              <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
                Send reset link
              </Button>
              <button type="button" onClick={() => navigate('/login')}
                className="w-full text-center text-sm2 font-medium text-accent hover:underline">
                Back to sign in
              </button>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
