import * as React from 'react'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { useNavigate } from 'react-router-dom'
import { LogOut, Settings, User } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { Avatar } from '@/components/ui'

const ITEM = 'flex cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-2 text-sm2 text-label2 outline-none data-[highlighted]:bg-surface2 data-[highlighted]:text-label'

export function ProfileMenu() {
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  const name = me?.user.displayName ?? ''
  const role = me?.user.roleCode.replace(/_/g, ' ').toLowerCase() ?? ''

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <button
          aria-label="Account menu"
          className="ml-1 grid h-8 w-8 place-items-center rounded-full outline-none ring-accent/40 transition-opacity hover:opacity-80 data-[state=open]:ring-2"
        >
          <Avatar name={name} color={me?.employee?.avatarColor} size={28} />
        </button>
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={8}
          className="z-[70] w-60 overflow-hidden rounded-card border border-separator bg-surface p-1 shadow-sheet ring-1 ring-black/5 animate-in dark:ring-white/10"
        >
          <div className="flex items-center gap-2.5 px-2.5 py-2.5">
            <Avatar name={name} color={me?.employee?.avatarColor} size={34} />
            <div className="min-w-0">
              <p className="truncate text-sm2 font-semibold">{name}</p>
              <p className="truncate text-xs2 text-label2">{me?.user.email}</p>
              <p className="mt-0.5 truncate text-xs2 capitalize text-label2">{role}</p>
            </div>
          </div>

          <Menu.Separator className="my-1 h-px bg-separator" />

          {me?.user.employeeId ? (
            <Menu.Item className={ITEM} onSelect={() => navigate(`/employees/${me.user.employeeId}`)}>
              <User className="h-4 w-4" /> My profile
            </Menu.Item>
          ) : null}
          <Menu.Item className={ITEM} onSelect={() => navigate('/settings')}>
            <Settings className="h-4 w-4" /> Settings
          </Menu.Item>

          <Menu.Separator className="my-1 h-px bg-separator" />

          <Menu.Item className={`${ITEM} data-[highlighted]:text-bad`} onSelect={logout}>
            <LogOut className="h-4 w-4" /> Sign out
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
