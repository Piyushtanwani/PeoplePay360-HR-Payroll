import * as React from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface ToastMessage {
  id: number
  tone: 'success' | 'error' | 'info'
  title: string
  detail?: string
  requestId?: string
  action?: { label: string; onClick: () => void }
  /** How many times this exact message has fired since it last cleared. */
  count: number
}

const ToastContext = React.createContext<{ push: (t: Omit<ToastMessage, 'id' | 'count'>) => void }>({ push: () => {} })
/* eslint-disable-next-line react-refresh/only-export-components -- a context and its own hook belong in one file */
export const useToast = () => React.useContext(ToastContext)

/** Never more than this many at once: a burst of identical failures must not fill the screen. */
const MAX_VISIBLE = 4
const DISMISS_MS = 6000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastMessage[]>([])
  const timers = React.useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const scheduleDismiss = React.useCallback((id: number) => {
    const existing = timers.current.get(id)
    if (existing) clearTimeout(existing)
    timers.current.set(
      id,
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id))
        timers.current.delete(id)
      }, DISMISS_MS),
    )
  }, [])

  const push = React.useCallback(
    (toast: Omit<ToastMessage, 'id' | 'count'>) => {
      setItems((prev) => {
        // A repeat of the most recent toast becomes a count on the same card instead of a new one.
        // A burst of "Resend" clicks against a dead mail relay used to stack eight identical cards;
        // now it reads as one card that says how many times it happened.
        const last = prev[prev.length - 1]
        const isRepeat = last && last.tone === toast.tone && last.title === toast.title && last.detail === toast.detail
        if (isRepeat) {
          scheduleDismiss(last.id)
          return prev.map((t) => (t.id === last.id ? { ...t, count: t.count + 1 } : t))
        }
        const id = Date.now() + Math.random()
        scheduleDismiss(id)
        const next = [...prev, { ...toast, id, count: 1 }]
        return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next
      })
    },
    [scheduleDismiss],
  )

  React.useEffect(() => {
    const map = timers.current
    return () => map.forEach((t) => clearTimeout(t))
  }, [])

  const dismiss = (id: number) => {
    const t = timers.current.get(id)
    if (t) clearTimeout(t)
    timers.current.delete(id)
    setItems((prev) => prev.filter((toast) => toast.id !== id))
  }

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-2">
        {items.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-card border bg-surface px-4 py-3 shadow-sheet animate-in',
              toast.tone === 'error' ? 'border-bad/40' : toast.tone === 'success' ? 'border-ok/40' : 'border-separator',
            )}
          >
            {toast.tone === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" /> : toast.tone === 'error' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-bad" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm2 font-semibold">
                {toast.title}
                {toast.count > 1 ? <span className="ml-1.5 font-normal text-label2">×{toast.count}</span> : null}
              </p>
              {toast.detail ? <p className="mt-0.5 text-sm2 text-label2">{toast.detail}</p> : null}
              {toast.requestId ? (
                <details className="mt-1 text-xs2 text-label2">
                  <summary className="cursor-pointer">Details</summary>
                  <span className="tnum">requestId {toast.requestId}</span>
                </details>
              ) : null}
              {toast.action ? (
                <button onClick={toast.action.onClick} className="mt-1.5 text-sm2 font-medium text-accent hover:underline">
                  {toast.action.label}
                </button>
              ) : null}
            </div>
            <button aria-label="Dismiss" onClick={() => dismiss(toast.id)} className="text-label2 hover:text-label">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
