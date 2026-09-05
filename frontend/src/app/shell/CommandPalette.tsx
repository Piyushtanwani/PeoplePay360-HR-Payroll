import * as React from 'react'
import { Command } from 'cmdk'
import * as Dialog from '@radix-ui/react-dialog'
import { CornerDownLeft, Search } from 'lucide-react'
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
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px]" />
        {/*
          Centred with inset-x + mx-auto rather than a translate: the shared `animate-in`
          keyframe finishes on `transform: none`, which would cancel a centring transform.
        */}
        <Dialog.Content
          className="fixed inset-x-4 top-[14vh] z-[90] mx-auto max-w-xl overflow-hidden rounded-sheet border border-separator bg-surface shadow-sheet ring-1 ring-black/5 animate-in dark:ring-white/10"
        >
          <Dialog.Title className="sr-only">Search screens</Dialog.Title>
          <Command loop>
            <div className="flex items-center gap-2.5 border-b border-separator px-4">
              <Search className="h-4 w-4 shrink-0 text-label2" />
              <Command.Input
                autoFocus
                placeholder="Jump to a screen…"
                className="w-full bg-transparent py-3.5 text-body outline-none focus-visible:outline-none placeholder:text-label2"
              />
              <kbd className="hidden shrink-0 rounded border border-separator px-1.5 py-0.5 text-xs2 text-label2 sm:block">esc</kbd>
            </div>

            <Command.List className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-sm2 text-label2">
                Nothing matches that search.
              </Command.Empty>
              {groups.map((group) => (
                <Command.Group
                  key={group.label}
                  heading={group.label}
                  className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs2 [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-label2"
                >
                  {group.items.map((item) => (
                    <Command.Item
                      key={item.to}
                      value={`${group.label} ${item.label}`}
                      onSelect={() => { onNavigate(item.to); onOpenChange(false) }}
                      className="group flex cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-2 text-body text-label2 data-[selected=true]:bg-accent/12 data-[selected=true]:text-accent"
                    >
                      {item.icon}
                      <span className="flex-1 truncate">{item.label}</span>
                      <CornerDownLeft className="h-3.5 w-3.5 opacity-0 group-data-[selected=true]:opacity-60" />
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
