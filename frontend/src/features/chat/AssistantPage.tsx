import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowUp, Copy, MessageSquarePlus, PanelLeftClose, PanelLeftOpen, Receipt, ScrollText,
  Search, Sparkles, Square, Timer, Trash2, Wallet,
} from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import { cn } from '@/lib/cn'
import { Markdown } from './Markdown'
import type { ChatCapabilities, ChatMessage, ChatSession } from '@/api/types'

const SUGGESTIONS = [
  { icon: <Wallet className="h-4 w-4" />, title: 'Payroll', prompt: 'Explain how a payrun is computed, step by step.' },
  { icon: <ScrollText className="h-4 w-4" />, title: 'Contracts', prompt: 'What does a Running contract mean and why can there be only one?' },
  { icon: <Receipt className="h-4 w-4" />, title: 'Payslips', prompt: 'How does a leave allocation affect a payslip?' },
  { icon: <Timer className="h-4 w-4" />, title: 'Attendance', prompt: 'Which screen shows attendance exceptions before payroll?' },
]

/**
 * Reveals an assistant reply at a steady rate so a non-streaming provider still feels live.
 * Frame-timed rather than interval-stepped, so the pace holds regardless of reply length.
 */
function useTypewriter(full: string, active: boolean) {
  const [shown, setShown] = React.useState(active ? '' : full)
  React.useEffect(() => {
    if (!active) { setShown(full); return }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(full); return }
    const CHARS_PER_SECOND = 900
    let raf = 0
    let start = 0
    const tick = (now: number) => {
      if (!start) start = now
      const count = Math.floor(((now - start) / 1000) * CHARS_PER_SECOND)
      setShown(full.slice(0, Math.min(full.length, count)))
      if (count < full.length) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [full, active])
  return shown
}

function Turn({ message, animate }: { message: ChatMessage; animate: boolean }) {
  const isUser = message.role === 'user'
  const text = useTypewriter(message.content, animate && !isUser)
  const [copied, setCopied] = React.useState(false)

  const copy = () => {
    void navigator.clipboard?.writeText(message.content)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  if (isUser) {
    return (
      <div className="flex animate-in justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-[18px] bg-accent px-4 py-2.5 text-body text-white shadow-sm">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="group flex animate-in gap-3.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        {text ? <Markdown text={text} /> : <span className="inline-block animate-pulse text-label2">▍</span>}
        <button
          onClick={copy}
          className="mt-1.5 inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs2 text-label2 opacity-0 transition-opacity hover:text-label focus:opacity-100 group-hover:opacity-100"
        >
          <Copy className="h-3 w-3" /> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

export function AssistantPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const [sessionId, setSessionId] = React.useState<number | null>(null)
  const [draft, setDraft] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [animateId, setAnimateId] = React.useState<number | null>(null)
  const [pending, setPending] = React.useState<string | null>(null)
  const [railOpen, setRailOpen] = React.useState(() => localStorage.getItem('pp360.chatrail') !== 'closed')
  const [filter, setFilter] = React.useState('')
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => { localStorage.setItem('pp360.chatrail', railOpen ? 'open' : 'closed') }, [railOpen])

  const capabilities = useQuery({
    queryKey: ['chat', 'capabilities'],
    queryFn: () => api.get<ChatCapabilities>('/api/chat/capabilities'),
    staleTime: 60_000,
  })
  const sessions = useQuery({
    queryKey: ['chat', 'sessions'],
    queryFn: () => api.get<ChatSession[]>('/api/chat/sessions'),
  })
  const messages = useQuery({
    queryKey: ['chat', 'messages', sessionId],
    queryFn: () => api.get<ChatMessage[]>(`/api/chat/sessions/${sessionId}/messages`),
    enabled: sessionId !== null,
  })

  const ensureSession = React.useCallback(async (title: string) => {
    if (sessionId !== null) return sessionId
    const created = await api.post<ChatSession>('/api/chat/sessions', { title: title.slice(0, 60) })
    setSessionId(created.id)
    return created.id
  }, [sessionId])

  const send = useMutation({
    mutationFn: async (content: string) => {
      const id = await ensureSession(content)
      return api.post<ChatMessage>(`/api/chat/sessions/${id}/messages`, { content })
    },
    // Show the question immediately; the server list catches up once the reply lands.
    onMutate: (content: string) => { setError(null); setPending(content) },
    onSuccess: async (reply) => {
      setAnimateId(reply.id)
      await queryClient.invalidateQueries({ queryKey: ['chat', 'messages'] })
      setPending(null)
      void queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] })
    },
    onError: (e) => {
      setPending(null)
      setError(e instanceof ApiError ? e.detail : 'The assistant is unavailable.')
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/api/chat/sessions/${id}`),
    onSuccess: (_r, id) => {
      if (id === sessionId) setSessionId(null)
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] })
    },
  })

  React.useEffect(() => { inputRef.current?.focus() }, [sessionId])
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.data, pending, send.isPending])

  const submit = () => {
    const content = draft.trim()
    if (!content || send.isPending) return
    setDraft('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    send.mutate(content)
  }
  const newChat = () => { setSessionId(null); setError(null); setDraft(''); setPending(null); inputRef.current?.focus() }

  const rows = messages.data ?? []
  const configured = capabilities.data?.configured ?? true
  const empty = rows.length === 0 && !send.isPending && !pending
  const list = (sessions.data ?? []).filter((s) => s.title.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className="flex h-full min-h-0">
      {/* Conversation rail */}
      <aside
        className={cn(
          'hidden min-h-0 shrink-0 flex-col border-r border-separator bg-surface2/30 transition-[width] duration-200 lg:flex',
          railOpen ? 'w-[16.5rem]' : 'w-[3.5rem]',
        )}
      >
        <div className={cn('flex items-center gap-1 p-2', !railOpen && 'flex-col')}>
          <button
            onClick={newChat}
            title="New chat"
            className={cn(
              'flex items-center gap-2 rounded-control border border-separator bg-surface px-3 py-2 text-sm2 font-medium transition-colors hover:bg-surface2',
              railOpen ? 'flex-1' : 'h-9 w-9 justify-center px-0',
            )}
          >
            <MessageSquarePlus className="h-4 w-4 shrink-0" />
            {railOpen ? 'New chat' : null}
          </button>
          <button
            onClick={() => setRailOpen((v) => !v)}
            aria-label={railOpen ? 'Collapse conversations' : 'Expand conversations'}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-control text-label2 hover:bg-surface2"
          >
            {railOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
        </div>

        {railOpen ? (
          <>
            <div className="px-2 pb-2">
              <div className="flex h-9 items-center gap-2 rounded-control border border-separator bg-surface px-2.5 transition-colors focus-within:border-accent">
                <Search className="h-3.5 w-3.5 shrink-0 text-label2" />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search chats"
                  className="min-w-0 flex-1 bg-transparent text-sm2 outline-none focus-visible:outline-none placeholder:text-label2"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {list.length === 0 ? (
                <p className="px-2 py-8 text-center text-xs2 text-label2">
                  {filter ? 'No chats match.' : 'No conversations yet.'}
                </p>
              ) : null}
              {list.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    'group mb-0.5 flex items-center gap-1 rounded-control px-2 py-2 text-sm2 transition-colors',
                    s.id === sessionId ? 'bg-accent/12 text-accent' : 'text-label2 hover:bg-surface2',
                  )}
                >
                  <button onClick={() => setSessionId(s.id)} className="min-w-0 flex-1 truncate text-left">
                    {s.title}
                  </button>
                  <button
                    aria-label={`Delete ${s.title}`}
                    onClick={() => remove.mutate(s.id)}
                    className="shrink-0 opacity-0 transition-opacity hover:text-bad focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </aside>

      {/* Conversation */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-2.5 border-b border-separator px-4 py-2.5 sm:px-6">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/12 text-accent">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm2 font-semibold">Assistant</p>
            <p className="truncate text-xs2 text-label2">
              {capabilities.data?.model
                ? `${capabilities.data.provider?.toLowerCase()} · ${capabilities.data.model}`
                : 'Not configured'}
            </p>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-separator px-2.5 py-1 text-xs2 text-label2 sm:inline-flex">
            <span className={cn('h-1.5 w-1.5 rounded-full', configured ? 'bg-ok' : 'bg-warn')} />
            {configured ? 'Ready' : 'Not configured'}
          </span>
          <button onClick={newChat} aria-label="New chat" className="rounded-control p-1.5 text-label2 hover:bg-surface2 lg:hidden">
            <MessageSquarePlus className="h-4 w-4" />
          </button>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
            {!configured ? (
              <div className="mb-5 rounded-card border border-separator bg-surface2/60 p-4 text-sm2">
                <p className="font-medium">The assistant is not configured yet.</p>
                <p className="mt-1 text-label2">
                  {can('ai.settings')
                    ? 'Open AI Settings, pick a provider and paste an API key. Ollama on this machine needs no key.'
                    : 'Ask an administrator to set up an AI provider in AI Settings.'}
                </p>
              </div>
            ) : null}

            {empty && configured ? (
              <div className="flex min-h-[52vh] flex-col items-center justify-center gap-7 text-center">
                <div>
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/12 text-accent">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <h1 className="text-d2 font-semibold tracking-[-0.02em]">How can I help?</h1>
                  <p className="mt-1.5 text-sm2 text-label2">Ask about payroll, contracts, attendance or leave.</p>
                </div>
                <div className="grid w-full gap-2.5 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.title}
                      onClick={() => send.mutate(s.prompt)}
                      className="group rounded-card border border-separator bg-surface p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-card"
                    >
                      <span className="flex items-center gap-2 text-sm2 font-medium">
                        <span className="text-accent">{s.icon}</span>{s.title}
                      </span>
                      <span className="mt-1 block text-sm2 leading-snug text-label2">{s.prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-6">
              {rows.map((m) => <Turn key={m.id} message={m} animate={m.id === animateId} />)}

              {pending ? (
                <div className="flex animate-in justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-[18px] bg-accent px-4 py-2.5 text-body text-white shadow-sm">
                    {pending}
                  </div>
                </div>
              ) : null}

              {send.isPending ? (
                <div className="flex gap-3.5">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex items-center gap-1.5 pt-2">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-label2"
                        style={{ animationDelay: `${i * 120}ms` }} />
                    ))}
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-control border border-bad/30 bg-bad/8 px-3 py-2 text-sm2 text-bad">{error}</div>
              ) : null}
            </div>
          </div>
        </div>

        <footer className="shrink-0 px-4 pb-4 pt-1 sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <div className="flex items-end gap-2 rounded-[22px] border border-separator bg-surface px-3.5 py-2.5 shadow-card transition-colors focus-within:border-accent">
              <textarea
                ref={inputRef}
                rows={1}
                value={draft}
                disabled={!configured}
                onChange={(e) => {
                  setDraft(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
                placeholder={configured ? 'Ask anything…' : 'Configure a provider to start'}
                className="max-h-48 flex-1 resize-none bg-transparent py-1 text-body outline-none focus-visible:outline-none placeholder:text-label2 disabled:cursor-not-allowed"
              />
              <button
                onClick={submit}
                disabled={!draft.trim() || send.isPending || !configured}
                aria-label="Send message"
                className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-25"
              >
                {send.isPending ? <Square className="h-3 w-3" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-2 text-center text-xs2 text-label2">
              Enter to send, Shift+Enter for a new line. Live record lookups arrive with MCP tools, coming soon.
            </p>
          </div>
        </footer>
      </section>
    </div>
  )
}
