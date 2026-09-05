import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockAuth, renderPage } from '@/test/render'

let auth = mockAuth('ADMIN')
vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => auth }))

const capabilities = {
  configured: true,
  provider: 'OLLAMA',
  model: 'qwen3:latest',
  toolsAvailable: true,
  toolsStatus: 'READY' as const,
  tools: [{ name: 'whoami', description: 'Who the caller is' }],
}

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      get: vi.fn((path: string) => {
        if (path.endsWith('/capabilities')) return Promise.resolve(capabilities)
        return Promise.resolve([])
      }),
      post: vi.fn(() => Promise.resolve({})),
      del: vi.fn(() => Promise.resolve(undefined)),
    },
  }
})

import { AssistantPage } from './AssistantPage'

beforeEach(() => { auth = mockAuth('ADMIN') })

describe('AssistantPage', () => {
  it('carries no header bar above the conversation', () => {
    renderPage(<AssistantPage />, { path: '/assistant' })
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByText(/qwen3:latest/)).not.toBeInTheDocument()
  })

  it('offers exactly four openers', () => {
    renderPage(<AssistantPage />, { path: '/assistant' })
    expect(screen.getByText('How can I help?')).toBeInTheDocument()
    expect(screen.getAllByText(/^(My leave|My payslip|My attendance|Headcount|Approvals|Exceptions|Contracts|Payruns|Blockers|Figures|My access|How pay works)$/))
      .toHaveLength(4)
  })

  // The point of the change: an opener the reader cannot get an answer to teaches them the
  // assistant is broken, so each one is gated on the lookup it needs.
  it('offers an employee only questions about their own records', () => {
    auth = mockAuth('EMPLOYEE')
    renderPage(<AssistantPage />, { path: '/assistant' })
    expect(screen.getByText('My leave')).toBeInTheDocument()
    expect(screen.getByText('My payslip')).toBeInTheDocument()
    expect(screen.queryByText('Headcount')).not.toBeInTheDocument()
    expect(screen.queryByText('Payruns')).not.toBeInTheDocument()
    expect(screen.queryByText('Figures')).not.toBeInTheDocument()
  })

  it('offers a payroll manager the payroll questions', () => {
    auth = mockAuth('PAYROLL_MANAGER')
    renderPage(<AssistantPage />, { path: '/assistant' })
    expect(screen.getByText('Headcount')).toBeInTheDocument()
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument()
  })

  it('falls back to questions anybody can ask when a role holds almost nothing', () => {
    auth = { ...mockAuth('EMPLOYEE'), permissions: new Set<string>(), can: () => false, canAny: () => false }
    renderPage(<AssistantPage />, { path: '/assistant' })
    expect(screen.getByText('My access')).toBeInTheDocument()
    expect(screen.getByText('How pay works')).toBeInTheDocument()
  })
})
