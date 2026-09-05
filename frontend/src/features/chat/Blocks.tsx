import * as React from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Ban, Check, ShieldAlert, Wrench } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Tooltip } from '@/components/ui/primitives'
import type { ChatBlock, ChatToolCall } from '@/api/types'

/**
 * Renders the structured results the assistant's tools return.
 *
 * <p>An answer that says "40 employees" is a claim. The same answer with the table it was read from
 * is evidence, and the reader can check it without leaving the conversation. Table styling is copied
 * from the shared data table on purpose, so a table here looks like a table anywhere else.
 */

/** Plain-English names, because a reader should never have to decode a tool identifier. */
const TOOL_LABELS: Record<string, string> = {
  whoami: 'My account',
  employee_search: 'Employee search',
  employee_summary: 'Employee summary',
  timeoff_get_balance: 'Leave balance',
  timeoff_list_pending: 'Pending leave requests',
  attendance_list_exceptions: 'Attendance exceptions',
  payrun_list: 'Payruns',
  payrun_list_issues: 'Payrun blockers',
  payslip_list: 'Payslips',
  payslip_explain: 'Payslip breakdown',
  dashboard_kpis: 'Dashboard figures',
  contract_list_expiring: 'Expiring contracts',
  candidate_compare: 'Candidate comparison',
}

/** Why a lookup was refused, in the words the reader needs rather than the code the server sends. */
const DENIAL_REASONS: Record<string, string> = {
  PERMISSION_DENIED: 'Your role does not have permission to read this.',
  SCOPE_DENIED: 'The assistant may only read records, never change them.',
  OUT_OF_SCOPE: 'That is outside what this assistant covers.',
  NOT_FOUND: 'No record matched that reference.',
  BACKEND_ERROR: 'The record service did not answer.',
}

export function ToolTrace({ calls }: { calls: ChatToolCall[] }) {
  if (!calls.length) return null
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      {calls.map((call, i) => {
        const label = TOOL_LABELS[call.toolName] ?? call.toolName
        const reason = call.denialCode
          ? DENIAL_REASONS[call.denialCode] ?? call.denialCode
          : `Read from ${label.toLowerCase()}${call.latencyMs != null ? ` in ${call.latencyMs} ms` : ''}.`
        return (
          <Tooltip key={`${call.toolName}-${i}`} content={reason}>
            <span
              className={cn(
                'inline-flex cursor-help items-center gap-1 rounded-full border px-2 py-0.5 text-xs2',
                call.allowed
                  ? 'border-separator bg-surface2/60 text-label2'
                  : 'border-warn/30 bg-warn/10 text-warn',
              )}
            >
              {call.allowed ? <Check className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
              {label}
            </span>
          </Tooltip>
        )
      })}
    </div>
  )
}

export function BlockList({ blocks }: { blocks: ChatBlock[] }) {
  if (!blocks.length) return null
  const kpis = blocks.filter((b) => b.type === 'kpi')
  const rest = blocks.filter((b) => b.type !== 'kpi')
  return (
    <div className="mt-3 space-y-3">
      {kpis.length ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((b, i) => <Kpi key={i} block={b} />)}
        </div>
      ) : null}
      {rest.map((b, i) => <Block key={i} block={b} />)}
    </div>
  )
}

function Block({ block }: { block: ChatBlock }) {
  switch (block.type) {
    case 'table': return <TableBlock block={block} />
    case 'list': return <ListBlock block={block} />
    case 'link': return <LinkBlock block={block} />
    case 'refusal': return <RefusalBlock block={block} />
    case 'proposed_action': return <ActionBlock block={block} />
    default: return null
  }
}

function Kpi({ block }: { block: ChatBlock }) {
  const tone =
    block.variant === 'good' ? 'text-ok'
    : block.variant === 'bad' ? 'text-bad'
    : block.variant === 'warn' ? 'text-warn'
    : 'text-label'
  return (
    <div className="rounded-card border border-separator bg-surface p-3">
      <p className="text-xs2 uppercase tracking-wide text-label2">{block.title}</p>
      <p className={cn('mt-1 text-h3 font-semibold tabular-nums', tone)}>{block.value}</p>
      {block.subtitle ? <p className="mt-0.5 text-xs2 text-label2">{block.subtitle}</p> : null}
    </div>
  )
}

/** Same markup and spacing as the shared data table, so every table on the site reads alike. */
function TableBlock({ block }: { block: ChatBlock }) {
  const headers = block.headers ?? []
  const rows = block.rows ?? []
  return (
    <div className="overflow-hidden rounded-card border border-separator bg-surface">
      {block.title ? (
        <p className="border-b border-separator px-4 py-2 text-sm2 font-medium">{block.title}</p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-body">
          <thead>
            <tr className="border-b border-separator text-left">
              {headers.map((h) => (
                <th key={h} scope="col" className="px-4 py-2.5 text-xs2 font-semibold uppercase tracking-wide text-label2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-separator/60 last:border-0">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm2 text-label2">No rows matched.</p>
      ) : null}
    </div>
  )
}

function ListBlock({ block }: { block: ChatBlock }) {
  return (
    <div className="rounded-card border border-separator bg-surface p-3.5">
      {block.title ? <p className="mb-1.5 text-sm2 font-medium">{block.title}</p> : null}
      <ul className="space-y-1 text-body">
        {(block.items ?? []).map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-label2" />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** An in-app path becomes a router link; anything else stays a plain external anchor. */
function LinkBlock({ block }: { block: ChatBlock }) {
  const url = block.url ?? ''
  const internal = url.startsWith('/')
  const className =
    'inline-flex items-center gap-1.5 rounded-control border border-separator bg-surface px-3 py-1.5 text-sm2 font-medium transition-colors hover:bg-surface2'
  return internal ? (
    <Link to={url} className={className}>{block.label} <ArrowUpRight className="h-3.5 w-3.5" /></Link>
  ) : (
    <a href={url} target="_blank" rel="noreferrer" className={className}>
      {block.label} <ArrowUpRight className="h-3.5 w-3.5" />
    </a>
  )
}

function RefusalBlock({ block }: { block: ChatBlock }) {
  return (
    <div className="flex gap-2.5 rounded-card border border-warn/30 bg-warn/8 p-3.5 text-sm2">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
      <div>
        <p>{block.reason}</p>
        {block.suggestedTopic ? (
          <p className="mt-1 text-label2">Try asking about {block.suggestedTopic}.</p>
        ) : null}
      </div>
    </div>
  )
}

function ActionBlock({ block }: { block: ChatBlock }) {
  const target = block.target ?? ''
  if (!target.startsWith('/')) {
    return (
      <p className="flex items-center gap-2 text-sm2 text-label2">
        <Wrench className="h-3.5 w-3.5" /> {block.label}
      </p>
    )
  }
  return (
    <Link
      to={target}
      className="inline-flex items-center gap-1.5 rounded-control bg-accent px-3 py-1.5 text-sm2 font-medium text-white transition-opacity hover:opacity-90"
    >
      {block.label} <ArrowUpRight className="h-3.5 w-3.5" />
    </Link>
  )
}
