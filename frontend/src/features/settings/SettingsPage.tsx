import * as React from 'react'
import { Card, CardHeader, PageHeader, SegmentedControl, Toggle } from '@/components/ui'
import { applyTheme, readTheme, type Theme } from '@/app/theme'
import { useAuth } from '@/auth/AuthProvider'

export function SettingsPage() {
  const { me } = useAuth()
  const [theme, setTheme] = React.useState<Theme>(readTheme)
  const [dense, setDense] = React.useState(localStorage.getItem('pp360.density') === 'dense')

  return (
    <>
      <PageHeader title="Settings" description="These preferences are stored in this browser only." />
      <div className="grid max-w-2xl gap-4">
        <Card>
          <CardHeader title="Appearance" />
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm2 font-medium">Theme</p>
                <p className="text-xs2 text-label2">System follows your operating system setting.</p>
              </div>
              <SegmentedControl
                value={theme}
                onChange={(value) => { setTheme(value); applyTheme(value) }}
                options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm2 font-medium">Dense tables</p>
                <p className="text-xs2 text-label2">Reduces row height on long lists.</p>
              </div>
              <Toggle checked={dense} onChange={(v) => { setDense(v); localStorage.setItem('pp360.density', v ? 'dense' : 'comfortable') }} label="Dense tables" />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Session" />
          <dl className="divide-y divide-separator">
            {[
              ['Signed in as', me?.user.displayName ?? '—'],
              ['Role', me?.user.roleCode.replace(/_/g, ' ').toLowerCase() ?? '—'],
              ['Currency', me?.settings.currency ?? '—'],
              ['Timezone', me?.settings.timezone ?? '—'],
              ['Profile', me?.settings.profile ?? '—'],
              ['Permissions held', String(me?.permissions.length ?? 0)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-5 py-2.5 text-sm2">
                <dt className="text-label2">{label}</dt><dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </>
  )
}
