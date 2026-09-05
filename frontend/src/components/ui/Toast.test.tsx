import * as React from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from './Toast'

function Trigger() {
  const toast = useToast()
  return (
    <button onClick={() => toast.push({ tone: 'error', title: 'Could not send the email.', detail: 'Check the SMTP settings.' })}>
      fire
    </button>
  )
}

function renderToasts() {
  return render(<ToastProvider><Trigger /></ToastProvider>)
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('ToastProvider', () => {
  // The defect: eight identical clicks against a dead mail relay produced eight stacked cards
  // saying the same thing, rather than one card that says it happened eight times.
  it('collapses a repeated identical message into one card with a count', async () => {
    renderToasts()
    const user = { click: (el: HTMLElement) => act(() => el.click()) }
    const button = screen.getByRole('button', { name: 'fire' })
    for (let i = 0; i < 8; i++) user.click(button)

    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByText('×8')).toBeInTheDocument()
  })

  it('does not collapse two different messages', () => {
    function TwoMessages() {
      const toast = useToast()
      return (
        <>
          <button onClick={() => toast.push({ tone: 'error', title: 'A' })}>a</button>
          <button onClick={() => toast.push({ tone: 'error', title: 'B' })}>b</button>
        </>
      )
    }
    render(<ToastProvider><TwoMessages /></ToastProvider>)
    act(() => screen.getByRole('button', { name: 'a' }).click())
    act(() => screen.getByRole('button', { name: 'b' }).click())
    expect(screen.getAllByRole('status')).toHaveLength(2)
  })

  it('never shows more than four at once, even from unrelated messages', () => {
    function ManyMessages() {
      const toast = useToast()
      React.useEffect(() => {
        for (let i = 0; i < 6; i++) toast.push({ tone: 'info', title: `Message ${i}` })
      }, [toast])
      return null
    }
    render(<ToastProvider><ManyMessages /></ToastProvider>)
    expect(screen.getAllByRole('status')).toHaveLength(4)
    expect(screen.getByText('Message 5')).toBeInTheDocument()
    expect(screen.queryByText('Message 0')).not.toBeInTheDocument()
  })

  it('clears itself after the dismiss delay', () => {
    renderToasts()
    act(() => screen.getByRole('button', { name: 'fire' }).click())
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(6100))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('lets a repeated message clear on its own timer rather than the first click’s', () => {
    renderToasts()
    const button = screen.getByRole('button', { name: 'fire' })
    act(() => button.click())
    act(() => vi.advanceTimersByTime(5000))
    act(() => button.click()) // resets the timer
    act(() => vi.advanceTimersByTime(2000))
    expect(screen.getByRole('status')).toBeInTheDocument() // 7s since first click, but only 2s since the reset
    act(() => vi.advanceTimersByTime(4100))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('dismisses immediately when the close button is clicked', () => {
    renderToasts()
    act(() => screen.getByRole('button', { name: 'fire' }).click())
    act(() => screen.getByRole('button', { name: 'Dismiss' }).click())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
