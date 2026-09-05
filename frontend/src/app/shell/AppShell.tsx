import * as React from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Banknote, Building2, CalendarClock, ClipboardList, Command, FileSpreadsheet, Gauge, LayoutGrid,
  LogOut, Moon, PanelLeftClose, PanelLeftOpen, Receipt, ScrollText, Settings, ShieldCheck, Sun,
  Timer, Users, Wallet, Bell, HeartPulse, Cpu,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuth } from '@/auth/AuthProvider'
import { Avatar, Button, Chip, Tooltip } from '@/components/ui'
import { applyTheme, readTheme, type Theme } from '../theme'
import { CommandPalette } from './CommandPalette'
import { NotificationBell } from './NotificationBell'

export interface NavItem { to: string; label: string; icon: React.ReactNode; permission?: string | string[] }
export interface NavGroup { label: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  { label: 'Home', items: [{ to: '/', label: 'Dashboard', icon: <Gauge className="h-4 w-4" />, permission: 'dashboard.read.hr' }] },
  {
    label: 'People',
    items: [
      { to: '/employees', label: 'Employees', icon: <Users className="h-4 w-4" />, permission: 'employee.read.all' },
      { to: '/contracts', label: 'Contracts', icon: <ClipboardList className="h-4 w-4" />, permission: 'contract.read.own' },
      { to: '/schedules', label: 'Working Schedules', icon: <CalendarClock className="h-4 w-4" />, permission: 'schedule.read.all' },
    ],
  },
  {
    label: 'Time',
    items: [
      { to: '/attendance', label: 'Attendance', icon: <Timer className="h-4 w-4" />, permission: ['attendance.read.own', 'attendance.read.all'] },
      { to: '/timeoff', label: 'Time Off', icon: <LayoutGrid className="h-4 w-4" />, permission: ['timeoff_request.read.own', 'timeoff_request.read.all'] },
    ],
  },
  {
    label: 'Payroll',
    items: [
      { to: '/payroll/payruns', label: 'Payruns', icon: <Wallet className="h-4 w-4" />, permission: 'payrun.read' },
      { to: '/payroll/payslips', label: 'Payslips', icon: <Receipt className="h-4 w-4" />, permission: ['payslip.read.own', 'payslip.read.all'] },
      { to: '/payroll/salary-structures', label: 'Salary Structures', icon: <FileSpreadsheet className="h-4 w-4" />, permission: 'salary_structure.read' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/admin/users', label: 'Users & Access', icon: <ShieldCheck className="h-4 w-4" />, permission: 'user.read' },
      { to: '/admin/ai', label: 'AI Settings', icon: <Cpu className="h-4 w-4" />, permission: 'ai.settings' },
      { to: '/admin/audit', label: 'Audit Log', icon: <ScrollText className="h-4 w-4" />, permission: 'audit.read' },
      { to: '/admin/health', label: 'Health', icon: <HeartPulse className="h-4 w-4" />, permission: 'user.read' },
    ],
  },
]

const CRUMBS: Record<string, string> = {
  '/': 'Dashboard', '/employees': 'Employees', '/contracts': 'Contracts', '/schedules': 'Working Schedules',
  '/attendance': 'Attendance', '/timeoff': 'Time Off', '/payroll/payruns': 'Payruns', '/payroll/payslips': 'Payslips',
  '/payroll/salary-structures': 'Salary Structures', '/admin/users': 'Users & Access', '/admin/ai': 'AI Settings',
  '/admin/audit': 'Audit Log', '/admin/health': 'Health', '/settings': 'Settings',
}

export function AppShell() {
  const { me, logout, canAny } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = React.useState(() => localStorage.getItem('pp360.sidebar') === 'rail')
  const [theme, setTheme] = React.useState<Theme>(readTheme)
  const [paletteOpen, setPaletteOpen] = React.useState(false)

  React.useEffect(() => {
    localStorage.setItem('pp360.sidebar', collapsed ? 'rail' : 'full')
  }, [collapsed])

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || canAny(Array.isArray(item.permission) ? item.permission : [item.permission])),
  })).filter((group) => group.items.length > 0)

  const cycleTheme = () => {
    const next: Theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
    setTheme(next)
    applyTheme(next)
  }

  const crumb = CRUMBS[location.pathname] ?? Object.entries(CRUMBS).find(([path]) => path !== '/' && location.pathname.startsWith(path))?.[1] ?? ''

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <aside
        className={cn(
          'glass hidden shrink-0 flex-col border-r border-separator transition-[width] duration-200 md:flex',
          collapsed ? 'w-[72px]' : 'w-[260px]',
        )}
      >
        <div className={cn('flex h-14 items-center gap-2 px-4', collapsed && 'justify-center px-0')}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-accent text-white">
            <Building2 className="h-4 w-4" />
          </span>
          {!collapsed ? <span className="truncate text-[15px] font-semibold">PeoplePay360</span> : null}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {groups.map((group) => (
            <div key={group.label} className="mb-4">
              {!collapsed ? (
                <p className="px-3 pb-1 text-xs2 font-semibold uppercase tracking-wide text-label2">{group.label}</p>
              ) : null}
              {group.items.map((item) => (
                <Tooltip key={item.to} content={collapsed ? item.label : null}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'mb-0.5 flex items-center gap-2.5 rounded-control px-3 py-2 text-sm2 font-medium transition-colors',
                        collapsed && 'justify-center px-0',
                        isActive ? 'bg-accent/12 text-accent' : 'text-label2 hover:bg-surface2 hover:text-label',
                      )
                    }
                  >
                    {item.icon}
                    {!collapsed ? <span className="truncate">{item.label}</span> : null}
                  </NavLink>
                </Tooltip>
              ))}
            </div>
          ))}
        </nav>

        <button
          onClick={() => setCollapsed((v) => !v)}
          className="m-2 flex items-center justify-center gap-2 rounded-control py-2 text-sm2 text-label2 hover:bg-surface2"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /> Collapse</>}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass flex h-14 shrink-0 items-center justify-between gap-3 border-b border-separator px-4">
          <div className="flex min-w-0 items-center gap-2 text-sm2 text-label2">
            <span className="hidden sm:inline">PeoplePay360</span>
            <span className="hidden sm:inline">/</span>
            <span className="truncate font-medium text-label">{crumb}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="subtle" onClick={() => setPaletteOpen(true)} className="hidden gap-2 sm:inline-flex">
              <Command className="h-3.5 w-3.5" /> Search
              <kbd className="rounded bg-surface px-1 text-xs2 text-label2">⌘K</kbd>
            </Button>
            <NotificationBell />
            <Tooltip content={`Theme: ${theme}`}>
              <Button size="sm" variant="ghost" aria-label="Toggle theme" onClick={cycleTheme} className="h-8 w-8 p-0">
                {theme === 'dark' ? <Moon className="h-4 w-4" /> : theme === 'light' ? <Sun className="h-4 w-4" /> : <Bell className="hidden" />}
                {theme === 'system' ? <Sun className="h-4 w-4 opacity-60" /> : null}
              </Button>
            </Tooltip>
            <div className="ml-1 flex items-center gap-2 rounded-full border border-separator bg-surface py-1 pl-1 pr-3">
              <Avatar name={me?.user.displayName ?? ''} color={me?.employee?.avatarColor} size={26} />
              <div className="hidden leading-tight sm:block">
                <p className="text-xs2 font-semibold">{me?.user.displayName}</p>
                <p className="text-xs2 text-label2">{me?.user.roleCode.replace(/_/g, ' ').toLowerCase()}</p>
              </div>
              <Tooltip content="Sign out">
                <button aria-label="Sign out" onClick={logout} className="text-label2 hover:text-bad">
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} groups={groups} onNavigate={(to) => navigate(to)} />
    </div>
  )
}
