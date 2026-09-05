import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle, ArrowUp, Calculator, Calendar, CalendarDays, Check, Clock, Copy, FileSpreadsheet, FileText,
  MessageSquarePlus, PanelLeftClose, PanelLeftOpen, Pencil,
  Search, Send, Sparkles, Square, Timer, Trash2, TrendingUp, User, Users, Wrench,
} from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import { cn } from '@/lib/cn'
import { Markdown } from './Markdown'
import { BlockList } from './Blocks'
import type { ChatCapabilities, ChatMessage, ChatSession } from '@/api/types'

interface QueryPrompt {
  icon: React.ReactNode
  title: string
  prompt: string
}

const MANAGER_QUERIES: QueryPrompt[] = [
  {
    icon: <Users className="h-4 w-4" />,
    title: '360° Employee Dossier',
    prompt: 'Give me a 360-degree employee summary for Jordan Lee.',
  },
  {
    icon: <Calculator className="h-4 w-4" />,
    title: 'Payslip Math & Formula',
    prompt: "Explain the calculation formula behind Jordan Lee's payslip.",
  },
  {
    icon: <Timer className="h-4 w-4" />,
    title: 'Attendance Exceptions',
    prompt: 'Who has missing check-outs this week?',
  },
  {
    icon: <AlertCircle className="h-4 w-4" />,
    title: 'Payrun Pre-Flight Checks',
    prompt: 'Is anything blocking the latest payrun from being validated?',
  },
  {
    icon: <CalendarDays className="h-4 w-4" />,
    title: 'Expiring Contracts Radar',
    prompt: 'Which employee contracts are expiring soon?',
  },
  {
    icon: <Wrench className="h-4 w-4" />,
    title: 'FastMCP Live Gateway',
    prompt: 'What live MCP tools are active and what records can they query?',
  },
]

const PAYROLL_MANAGER_QUERIES: QueryPrompt[] = [
  {
    icon: <AlertCircle className="h-4 w-4" />,
    title: 'Payrun Pre-Flight Checks',
    prompt: 'Is anything blocking the latest payrun from being validated?',
  },
  {
    icon: <Calculator className="h-4 w-4" />,
    title: 'Payslip Math & Formula',
    prompt: "Explain the calculation formula behind Jordan Lee's payslip.",
  },
  {
    icon: <FileSpreadsheet className="h-4 w-4" />,
    title: 'Payrun Batches & Totals',
    prompt: 'Show recent payruns, their validation status, and total disbursement amounts.',
  },
  {
    icon: <Timer className="h-4 w-4" />,
    title: 'Attendance & Overtime',
    prompt: 'Who has missing check-outs or overtime this week that affects payroll?',
  },
  {
    icon: <CalendarDays className="h-4 w-4" />,
    title: 'Expiring Contracts Radar',
    prompt: 'Which employee contracts are expiring soon?',
  },
  {
    icon: <TrendingUp className="h-4 w-4" />,
    title: 'Payroll Spend & KPIs',
    prompt: 'Give me an executive KPI overview of current payroll spend and active headcount.',
  },
]

const EMPLOYEE_QUERIES: QueryPrompt[] = [
  {
    icon: <Calendar className="h-4 w-4" />,
    title: 'Paid Leave',
    prompt: 'How many days of paid leave do I have left?',
  },
  {
    icon: <Calculator className="h-4 w-4" />,
    title: 'Payslip & Deductions',
    prompt: 'Explain the deductions and net pay on my latest payslip.',
  },
  {
    icon: <Timer className="h-4 w-4" />,
    title: 'Attendance',
    prompt: 'Do I have any missing check-ins or attendance exceptions this month?',
  },
  {
    icon: <Clock className="h-4 w-4" />,
    title: 'Pending Leave',
    prompt: 'What is the status of my pending time-off requests?',
  },
  {
    icon: <User className="h-4 w-4" />,
    title: 'Profile & Manager',
    prompt: 'Show my profile details, department, and assigned manager.',
  },
  {
    icon: <FileText className="h-4 w-4" />,
    title: 'Current Contract',
    prompt: 'What are the key terms and renewal date on my current contract?',
  },
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

function Turn({
  message,
  animate,
  disabled,
  onEdit,
}: {
  message: ChatMessage
  animate: boolean
  disabled?: boolean
  onEdit?: (messageId: number, newContent: string) => void
}) {
  const isUser = message.role === 'user'
  const text = useTypewriter(message.content, animate && !isUser)
  const [copied, setCopied] = React.useState(false)
  const [isEditing, setIsEditing] = React.useState(false)
  const [editDraft, setEditDraft] = React.useState(message.content)
  const editTextareaRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    setEditDraft(message.content)
  }, [message.content])

  React.useEffect(() => {
    if (isEditing) {
      setEditDraft(message.content)
      const timer = setTimeout(() => {
        if (editTextareaRef.current) {
          editTextareaRef.current.focus()
          editTextareaRef.current.style.height = 'auto'
          editTextareaRef.current.style.height = `${Math.min(editTextareaRef.current.scrollHeight, 240)}px`
        }
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isEditing, message.content])

  const copy = () => {
    void navigator.clipboard?.writeText(message.content)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  const handleSaveEdit = () => {
    const trimmed = editDraft.trim()
    if (!trimmed) return
    setIsEditing(false)
    if (onEdit) {
      onEdit(message.id, trimmed)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditDraft(message.content)
    }
  }

  if (isUser) {
    if (isEditing) {
      return (
        <div className="flex animate-in justify-end">
          <div className="w-full max-w-[85%] rounded-2xl border border-accent/40 bg-surface p-3.5 shadow-md">
            <textarea
              ref={editTextareaRef}
              value={editDraft}
              onChange={(e) => {
                setEditDraft(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 240)}px`
              }}
              onKeyDown={handleKeyDown}
              className="w-full resize-none bg-transparent text-sm2 leading-relaxed text-label outline-none placeholder:text-label2"
              placeholder="Edit your prompt..."
              rows={2}
            />
            <div className="mt-2.5 flex items-center justify-between border-t border-separator/60 pt-2 text-xs2">
              <span className="text-label2">
                Press <kbd className="rounded border border-separator bg-surface2 px-1 py-0.5 font-mono">Enter</kbd> to send, <kbd className="rounded border border-separator bg-surface2 px-1 py-0.5 font-mono">Esc</kbd> to cancel
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false)
                    setEditDraft(message.content)
                  }}
                  className="rounded-control px-2.5 py-1 text-label2 transition-colors hover:bg-surface2 hover:text-label"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={!editDraft.trim() || disabled}
                  className="inline-flex items-center gap-1.5 rounded-control bg-accent px-3 py-1 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <Send className="h-3 w-3" />
                  <span>Send</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="group flex animate-in justify-end gap-2">
        {/* Action icons on hover */}
        <div className="flex items-center gap-1 self-center opacity-0 transition-opacity group-hover:opacity-100">
          {!disabled ? (
            <button
              onClick={() => setIsEditing(true)}
              title="Edit prompt"
              aria-label="Edit prompt"
              className="grid h-7 w-7 place-items-center rounded-control text-label2 hover:bg-surface2 hover:text-label"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button
            onClick={copy}
            title={copied ? 'Copied' : 'Copy prompt'}
            aria-label="Copy prompt"
            className="grid h-7 w-7 place-items-center rounded-control text-label2 hover:bg-surface2 hover:text-label"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-good" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>

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
        {/* Held back until the reply has finished revealing, so the answer and its evidence
            do not fight for attention mid-animation. */}
        {text === message.content ? <BlockList blocks={message.blocks ?? []} /> : null}
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
  const { can, user } = useAuth()
  const queryClient = useQueryClient()
  const [sessionId, setSessionId] = React.useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('pp360.active_chat_session')
      return saved ? Number(saved) : null
    } catch {
      return null
    }
  })
  const [draft, setDraft] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [animateId, setAnimateId] = React.useState<number | null>(null)
  const [pending, setPending] = React.useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = React.useState<number | null>(null)
  const [editedPromptContent, setEditedPromptContent] = React.useState<string | null>(null)
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

  // Clear stale session on user switch
  React.useEffect(() => {
    setSessionId(null)
    try { localStorage.removeItem('pp360.active_chat_session') } catch {}
  }, [user?.id])

  // Validate that the loaded sessionId actually belongs to this user's active sessions
  React.useEffect(() => {
    if (sessionId !== null && sessions.data && !sessions.isLoading) {
      const exists = sessions.data.some((s) => s.id === sessionId)
      if (!exists) {
        setSessionId(null)
        try { localStorage.removeItem('pp360.active_chat_session') } catch {}
      }
    }
  }, [sessionId, sessions.data, sessions.isLoading])

  // If loading messages produces an error (e.g. 404), reset the session
  React.useEffect(() => {
    if (messages.isError) {
      setSessionId(null)
      try { localStorage.removeItem('pp360.active_chat_session') } catch {}
    }
  }, [messages.isError])

  const ensureSession = React.useCallback(async (title: string) => {
    if (sessionId !== null) {
      const exists = (sessions.data ?? []).some((s) => s.id === sessionId)
      if (exists) return sessionId
    }
    const created = await api.post<ChatSession>('/api/chat/sessions', { title: title.slice(0, 60) })
    setSessionId(created.id)
    try { localStorage.setItem('pp360.active_chat_session', String(created.id)) } catch {}
    return created.id
  }, [sessionId, sessions.data])

  const send = useMutation({
    mutationFn: async (content: string) => {
      const id = await ensureSession(content)
      try {
        return await api.post<ChatMessage>(`/api/chat/sessions/${id}/messages`, { content })
      } catch (err) {
        // Auto-heal: If 404 chat_session, create a new session and retry once
        if (err instanceof ApiError && (err.status === 404 || err.detail?.includes('chat_session'))) {
          setSessionId(null)
          try { localStorage.removeItem('pp360.active_chat_session') } catch {}
          const fresh = await api.post<ChatSession>('/api/chat/sessions', { title: content.slice(0, 60) })
          setSessionId(fresh.id)
          try { localStorage.setItem('pp360.active_chat_session', String(fresh.id)) } catch {}
          await queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] })
          return await api.post<ChatMessage>(`/api/chat/sessions/${fresh.id}/messages`, { content })
        }
        throw err
      }
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

  // Edit in-place mutation: updates the prompt inside the same bubble without appending another prompt
  const editSend = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: number; content: string }) => {
      const id = await ensureSession(content)
      return await api.post<ChatMessage>(`/api/chat/sessions/${id}/messages`, { content, editMessageId: messageId })
    },
    onMutate: ({ messageId, content }) => {
      setError(null)
      setEditingMessageId(messageId)
      setEditedPromptContent(content)
    },
    onSuccess: async (reply, { messageId, content }) => {
      setAnimateId(reply.id)
      queryClient.setQueryData<ChatMessage[]>(['chat', 'messages', sessionId], (old) => {
        if (!old) return [reply]
        const idx = old.findIndex((m) => m.id === messageId)
        if (idx === -1) return [...old, reply]
        const prefix = old.slice(0, idx + 1).map((m) =>
          m.id === messageId ? { ...m, content } : m
        )
        return [...prefix, reply]
      })
      setEditingMessageId(null)
      setEditedPromptContent(null)
      await queryClient.invalidateQueries({ queryKey: ['chat', 'messages'] })
      void queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] })
    },
    onError: (e) => {
      setEditingMessageId(null)
      setEditedPromptContent(null)
      setError(e instanceof ApiError ? e.detail : 'The assistant is unavailable.')
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/api/chat/sessions/${id}`),
    onSuccess: (_r, id) => {
      if (id === sessionId) {
        setSessionId(null)
        try { localStorage.removeItem('pp360.active_chat_session') } catch {}
      }
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] })
    },
  })

  React.useEffect(() => { inputRef.current?.focus() }, [sessionId])
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.data, pending, send.isPending, editSend.isPending])

  const submit = () => {
    const content = draft.trim()
    if (!content || send.isPending || editSend.isPending) return
    setDraft('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    send.mutate(content)
  }
  const newChat = () => {
    setSessionId(null)
    try { localStorage.removeItem('pp360.active_chat_session') } catch {}
    setError(null)
    setDraft('')
    setPending(null)
    setEditingMessageId(null)
    setEditedPromptContent(null)
    inputRef.current?.focus()
  }

  const rows = messages.data ?? []
  const visibleRows = React.useMemo(() => {
    if (editingMessageId === null) return rows
    const idx = rows.findIndex((m) => m.id === editingMessageId)
    if (idx === -1) return rows
    return rows.slice(0, idx + 1).map((m) =>
      m.id === editingMessageId && editedPromptContent ? { ...m, content: editedPromptContent } : m
    )
  }, [rows, editingMessageId, editedPromptContent])
  const configured = capabilities.data?.configured ?? true
  const toolNames = (capabilities.data?.tools ?? []).map((t) => t.name)
  const toolsReady = capabilities.data?.toolsStatus === 'READY' && toolNames.length > 0
  const isPayroll = user?.roleCode === 'HR_PAYROLL_MANAGER' || user?.roleCode === 'HR_PAYROLL_USER'
  const isManager = can('employee.read.all') || can('payrun.read') || can('attendance.read.all')
  const suggestedQueries = isPayroll
    ? PAYROLL_MANAGER_QUERIES
    : isManager
    ? MANAGER_QUERIES
    : EMPLOYEE_QUERIES
  const empty = rows.length === 0 && !send.isPending && !pending && !editSend.isPending
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
              <div className="flex min-h-[48vh] flex-col items-center justify-center gap-6 text-center">
                <div>
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/12 text-accent">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <h1 className="text-d2 font-semibold tracking-[-0.02em]">How can I help you today?</h1>
                  <p className="mt-1 text-sm2 text-label2">
                    Select a suggested question below or type your own.
                  </p>
                </div>

                {/* Simple, intuitive suggestions grid */}
                <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {suggestedQueries.map((s) => (
                    <button
                      key={s.prompt}
                      type="button"
                      onClick={() => send.mutate(s.prompt)}
                      className="group flex flex-col justify-between rounded-xl border border-separator/80 bg-surface p-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-accent/60 hover:bg-surface2/40 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <div>
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
                            {s.icon}
                          </div>
                          <span className="text-xs font-semibold text-label">
                            {s.title}
                          </span>
                        </div>
                        <p className="mt-2.5 text-sm2 leading-snug text-label2 transition-colors group-hover:text-label">
                          {s.prompt}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center gap-1 text-xs2 font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
                        <span>Ask</span>
                        <span>→</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-6">
              {visibleRows.map((m) => (
                <Turn
                  key={m.id}
                  message={m}
                  animate={m.id === animateId}
                  disabled={send.isPending || editSend.isPending}
                  onEdit={(messageId, content) => editSend.mutate({ messageId, content })}
                />
              ))}

              {pending ? (
                <div className="flex animate-in justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-[18px] bg-accent px-4 py-2.5 text-body text-white shadow-sm">
                    {pending}
                  </div>
                </div>
              ) : null}

              {(send.isPending || editSend.isPending) ? (
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
              <button
                onClick={newChat}
                aria-label="New chat"
                className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-label2 transition-colors hover:bg-surface2 lg:hidden"
              >
                <MessageSquarePlus className="h-4 w-4" />
              </button>
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
                disabled={!draft.trim() || send.isPending || editSend.isPending || !configured}
                aria-label="Send message"
                className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-25"
              >
                {(send.isPending || editSend.isPending) ? <Square className="h-3 w-3" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-2 text-center text-xs2 text-label2">
              Enter to send, Shift+Enter for a new line.{' '}
              {toolsReady
                ? 'Answers about your records are read live, and only from records your role may see.'
                : 'Record lookups are offline, so answers come from general knowledge only.'}
            </p>
          </div>
        </footer>
      </section>


    </div>
  )
}
