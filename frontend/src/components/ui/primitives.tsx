import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'
import { describeStatus, toneFor } from './status'

/* ------------------------------------------------------------- Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:brightness-110 active:brightness-95 shadow-sm',
  secondary: 'bg-surface text-label border border-separator hover:bg-surface2',
  ghost: 'text-label hover:bg-surface2',
  subtle: 'bg-surface2 text-label hover:brightness-95 dark:hover:brightness-110',
  danger: 'bg-bad text-white hover:brightness-110',
}
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm2 gap-1.5',
  md: 'h-9 px-3.5 text-body gap-2',
  lg: 'h-11 px-5 text-body gap-2',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-control font-medium transition-[background,filter,opacity] duration-150',
        'disabled:cursor-not-allowed disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  )
})

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent', className)}
      aria-hidden
    />
  )
}

/** A square, icon-only button. The label is required because the icon alone is not a name. */
export const IconButton = React.forwardRef<HTMLButtonElement, ButtonProps & { label: string }>(function IconButton(
  { label, className, children, ...props },
  ref,
) {
  return (
    <Tooltip content={label}>
      <Button ref={ref} aria-label={label} variant="ghost" className={cn('h-8 w-8 p-0', className)} {...props}>
        {children}
      </Button>
    </Tooltip>
  )
})

/* --------------------------------------------------------------- Card */

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-card border border-separator bg-surface shadow-card', className)} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action, help, className }: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
  /** A HelpPopover, for a panel whose figures need explaining. */
  help?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-separator px-5 py-4', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <h2 className="truncate text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
          {help}
        </div>
        {subtitle ? <p className="mt-0.5 text-sm2 text-label2">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}

/* --------------------------------------------------- Chips and badges */

export function Chip({ tone = 'neutral', className, children }: { tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'bad' | 'purple' | 'teal'; className?: string; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    neutral: 'bg-surface2 text-label2',
    accent: 'bg-accent/12 text-accent',
    ok: 'bg-ok/14 text-ok',
    warn: 'bg-warn/16 text-warn',
    bad: 'bg-bad/14 text-bad',
    purple: 'bg-purple/14 text-purple',
    teal: 'bg-teal/16 text-teal',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs2 font-medium', tones[tone], className)}>
      {children}
    </span>
  )
}

/**
 * A status, with its meaning attached.
 *
 * The tooltip is on by default: a colour alone does not tell anyone what NEEDS_ATTENTION requires of
 * them, and this is the one place every status in the app passes through.
 */
export function StatusBadge({ status, className, tooltip = true }: {
  status: string
  className?: string
  tooltip?: boolean
}) {
  const label = status.replace(/_/g, ' ').toLowerCase().replace(/^./, (m) => m.toUpperCase())
  const badge = (
    <Chip tone={toneFor(status)} className={className}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </Chip>
  )
  const description = tooltip ? describeStatus(status) : undefined
  if (!description) return badge
  return <Tooltip content={description}><span className="inline-flex">{badge}</span></Tooltip>
}

/** A boolean shown as a status, so `active` never borrows the payrun word "Cancelled". */
export function ActiveBadge({ active, labels = ['Active', 'Inactive'], className }: {
  active: boolean
  labels?: [string, string]
  className?: string
}) {
  return (
    <Tooltip content={active ? describeStatus('ACTIVE') : describeStatus('INACTIVE')}>
      <span className="inline-flex">
        <Chip tone={active ? 'ok' : 'neutral'} className={className}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
          {active ? labels[0] : labels[1]}
        </Chip>
      </span>
    </Tooltip>
  )
}

/* ------------------------------------------------------------ Avatar */

export function Avatar({ name, color, size = 32, className }: { name: string; color?: string; size?: number; className?: string }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white', className)}
      style={{ width: size, height: size, background: color ?? '#0A84FF', fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

/* ---------------------------------------------------------- Skeleton */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('relative overflow-hidden rounded-md bg-surface2', className)}><span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-black/5 to-transparent dark:via-white/5" /></div>
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-5" />
          ))}
        </div>
      ))}
    </div>
  )
}

/* -------------------------------------------------- Empty / error states */

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon ? <div className="mb-1 text-label2">{icon}</div> : null}
      <p className="text-[17px] font-semibold">{title}</p>
      {description ? <p className="max-w-sm text-sm2 text-label2">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}

export function Callout({ tone = 'neutral', title, children, action }: { tone?: 'neutral' | 'warn' | 'bad' | 'accent' | 'ok'; title?: string; children: React.ReactNode; action?: React.ReactNode }) {
  const tones: Record<string, string> = {
    neutral: 'border-separator bg-surface2',
    accent: 'border-accent/30 bg-accent/8',
    ok: 'border-ok/30 bg-ok/8',
    warn: 'border-warn/35 bg-warn/10',
    bad: 'border-bad/35 bg-bad/10',
  }
  return (
    <div className={cn('flex items-start justify-between gap-4 rounded-card border px-4 py-3', tones[tone])}>
      <div className="min-w-0 text-sm2">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className="text-label2">{children}</div>
      </div>
      {action}
    </div>
  )
}

/* -------------------------------------------------- Segmented control */

export function SegmentedControl<T extends string>({ value, onChange, options, size = 'md', className }: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: React.ReactNode; disabled?: boolean }[]
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div className={cn('inline-flex rounded-control bg-surface2 p-0.5', className)} role="tablist">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-[8px] font-medium transition-all duration-150 disabled:opacity-40',
              size === 'sm' ? 'px-2.5 py-1 text-xs2' : 'px-3 py-1.5 text-sm2',
              active ? 'bg-surface text-label shadow-sm' : 'text-label2 hover:text-label',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------ Switch */

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors duration-150 disabled:opacity-40',
        checked ? 'bg-ok' : 'bg-separator',
      )}
    >
      <SwitchPrimitive.Thumb className="block h-[22px] w-[22px] translate-x-0.5 rounded-full bg-white shadow transition-transform duration-150 data-[state=checked]:translate-x-[20px]" />
    </SwitchPrimitive.Root>
  )
}

/* ----------------------------------------------------------- Tooltip */

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={250}>{children}</TooltipPrimitive.Provider>
}

export function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactNode }) {
  if (!content) return <>{children}</>
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="z-50 max-w-xs rounded-control border border-separator bg-surface px-2.5 py-1.5 text-xs2 text-label shadow-sheet"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

/* ------------------------------------------------- Permission refusal */

/**
 * What someone sees instead of a screen they may not open. Names the permission, so the person can
 * ask for it by name rather than reporting that "it does not work".
 */
export function NotPermitted({ requiredPermission, detail }: { requiredPermission?: string; detail?: string }) {
  return (
    <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
      <Lock className="mx-auto mb-3 h-6 w-6 text-label2" aria-hidden />
      <h2 className="text-[17px] font-semibold">Not permitted</h2>
      <p className="mt-1 text-sm2 text-label2">{detail ?? 'Your role does not include access to this screen.'}</p>
      {requiredPermission ? (
        <p className="mt-3 inline-block rounded-full bg-surface2 px-3 py-1 text-xs2 text-label2">
          Requires <span className="font-semibold text-label">{requiredPermission}</span>
        </p>
      ) : null}
    </Card>
  )
}

/* ---------------------------------------------------------- Page head */

/**
 * Every page says what it is for in one line, and anything beyond that goes behind the "?".
 * A screen with neither is a screen someone has to be told about.
 */
export function PageHeader({ title, description, actions, help, children }: {
  title: string
  description?: string
  actions?: React.ReactNode
  help?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-1.5">
          <h1 className="text-d3 font-semibold tracking-[-0.01em]">{title}</h1>
          {help}
        </div>
        {description ? <p className="mt-1 max-w-3xl text-sm2 text-label2">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
