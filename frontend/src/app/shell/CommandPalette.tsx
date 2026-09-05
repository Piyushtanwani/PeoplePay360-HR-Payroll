import * as React from 'react'
import { Command } from 'cmdk'
import * as Dialog from '@radix-ui/react-dialog'
import type { NavGroup } from './AppShell'

export function CommandPalette({ open, onOpenChange, groups, onNavigate }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: NavGroup[]
  onNavigate: (to: string) => void
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-[18%] z-[90] w-[calc(100vw-32px)] max-w-lg -translate-x-1/2 overflow-hidden rounded-sheet border border-separator bg-surface shadow-sheet animate-in">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Command loop>
            <Command.Input
              autoFocus
              placeholder="Jump to a screen…"
              className="w-full border-b border-separator bg-transparent px-4 py-3 text-body outline-none placeholder:text-label2"
            />
            <Command.List className="max-h-80 overflow-y-auto p-2">
              <Command.Empty className="px-3 py-6 text-center text-sm2 text-label2">No screen matches that search.</Command.Empty>
              {groups.map((group) => (
                <Command.Group key={group.label} heading={group.label} className="px-1 pb-2 text-xs2 font-semibold uppercase tracking-wide text-label2">
                  {group.items.map((item) => (
                    <Command.Item
                      key={item.to}
                      value={`${group.label} ${item.label}`}
                      onSelect={() => { onNavigate(item.to); onOpenChange(false) }}
                      className="flex cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-2 text-body font-normal normal-case tracking-normal text-label data-[selected=true]:bg-surface2"
                    >
                      {item.icon}
                      {item.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
