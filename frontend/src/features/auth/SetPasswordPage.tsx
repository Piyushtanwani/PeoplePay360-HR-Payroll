import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Building2, Check } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { Button, Callout, Card, Field, Spinner, TextInput } from '@/components/ui'

const MIN_LENGTH = 10

export function SetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''

  const [checking, setChecking] = React.useState(true)
  const [valid, setValid] = React.useState(false)
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [done, setDone] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    api.get<{ valid: boolean }>('/api/auth/set-password/check', { token })
      .then((r) => { if (!cancelled) setValid(r.valid) })
      .catch(() => { if (!cancelled) setValid(false) })
      .finally(() => { if (!cancelled) setChecking(false) })
    return () => { cancelled = true }
  }, [token])

  const tooShort = password.length > 0 && password.length < MIN_LENGTH
  const mismatch = confirm.length > 0 && password !== confirm
  const canSubmit = password.length >= MIN_LENGTH && password === confirm && !busy

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post('/api/auth/set-password', { token, password })
      setDone(true)
      window.setTimeout(() => navigate('/login', { replace: true }), 2200)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Could not set your password.')
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
            <p className="text-sm2 text-label2">Choose a password</p>
          </div>
        </div>

        <Card className="p-6">
          {checking ? (
            <div className="flex items-center justify-center gap-2 py-8 text-label2">
              <Spinner /> Checking your link…
            </div>
          ) : done ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-ok/12 text-ok">
                <Check className="h-5 w-5" />
              </div>
              <p className="font-medium">Password set</p>
              <p className="mt-1 text-sm2 text-label2">Taking you to sign in…</p>
            </div>
          ) : !valid ? (
            <div className="space-y-4">
              <Callout tone="bad">This link has expired or has already been used.</Callout>
              <p className="text-sm2 text-label2">
                Ask an administrator to send a new invite from Users &amp; Access.
              </p>
              <Button className="w-full" onClick={() => navigate('/login')}>Back to sign in</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Field label="New password" required htmlFor="pw"
                hint={`At least ${MIN_LENGTH} characters.`}>
                <TextInput id="pw" type="password" autoComplete="new-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} invalid={tooShort} required />
              </Field>
              <Field label="Confirm password" required htmlFor="pw2">
                <TextInput id="pw2" type="password" autoComplete="new-password" value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} invalid={mismatch} required />
              </Field>
              {mismatch ? <p className="text-sm2 text-bad">Both entries must match.</p> : null}
              {error ? <Callout tone="bad">{error}</Callout> : null}
              <Button type="submit" variant="primary" size="lg" loading={busy} disabled={!canSubmit} className="w-full">
                Set password
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
