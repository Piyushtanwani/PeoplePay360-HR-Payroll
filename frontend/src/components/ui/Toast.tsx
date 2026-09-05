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
}

const ToastContext = React.createContext<{ push: (t: Omit<ToastMessage, 'id'>) => void }>({ push: () => {} })
export const useToast = () => React.useContext(ToastContext)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastMessage[]>([])
  const push = React.useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev, { ...toast, id }])
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 6000)
  }, [])

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
              <p className="text-sm2 font-semibold">{toast.title}</p>
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
            <button aria-label="Dismiss" onClick={() => setItems((prev) => prev.filter((t) => t.id !== toast.id))} className="text-label2 hover:text-label">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
