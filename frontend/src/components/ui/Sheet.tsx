import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from './primitives'

export function Sheet({ open, onOpenChange, title, description, footer, width = 'md', children }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  width?: 'md' | 'lg' | 'xl'
  children: React.ReactNode
}) {
  const widths = { md: 'max-w-[520px]', lg: 'max-w-[680px]', xl: 'max-w-[880px]' }
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            'fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-separator bg-surface shadow-sheet',
            'duration-200 animate-in',
            widths[width],
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-separator px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-[17px] font-semibold">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-0.5 text-sm2 text-label2">{description}</Dialog.Description> : null}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" className="h-8 w-8 p-0" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <div className="flex items-center justify-end gap-2 border-t border-separator px-5 py-3">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function Modal({ open, onOpenChange, title, description, footer, children, wide }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-sheet border border-separator bg-surface p-5 shadow-sheet animate-in',
            wide ? 'max-w-3xl' : 'max-w-md',
          )}
        >
          <Dialog.Title className="text-[17px] font-semibold">{title}</Dialog.Title>
          {description ? <Dialog.Description className="mt-1 text-sm2 text-label2">{description}</Dialog.Description> : null}
          <div className="mt-4">{children}</div>
          {footer ? <div className="mt-5 flex items-center justify-end gap-2">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Financial and destructive actions always confirm with the exact sentence (A7). */
export function ConfirmDialog({ open, onOpenChange, title, sentence, confirmLabel, tone = 'primary', typeToConfirm, loading, onConfirm }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  sentence: React.ReactNode
  confirmLabel: string
  tone?: 'primary' | 'danger'
  typeToConfirm?: string
  loading?: boolean
  onConfirm: () => void
}) {
  const [typed, setTyped] = React.useState('')
  React.useEffect(() => { if (!open) setTyped('') }, [open])
  const blocked = Boolean(typeToConfirm) && typed.trim() !== typeToConfirm

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} disabled={blocked} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-body text-label2">{sentence}</p>
      {typeToConfirm ? (
        <div className="mt-4 space-y-1.5">
          <label htmlFor="confirm-input" className="text-sm2 text-label2">
            Type <span className="font-semibold text-label">{typeToConfirm}</span> to continue
          </label>
          <input
            id="confirm-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="h-9 w-full rounded-control border border-separator bg-surface px-3 outline-none focus:border-accent"
          />
        </div>
      ) : null}
    </Modal>
  )
}
