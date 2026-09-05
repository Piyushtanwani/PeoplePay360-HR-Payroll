import * as React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useTableState } from './useTableState'

/** Renders the hook inside a router and exposes the address bar, which is where the state lives. */
function setup(initial = '/employees', options?: Parameters<typeof useTableState>[0]) {
  return renderHook(
    () => ({ table: useTableState(options), location: useLocation() }),
    { wrapper: ({ children }) => <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter> },
  )
}

describe('useTableState', () => {
  it('starts on the first page with the requested defaults', () => {
    const { result } = setup('/employees', { defaultSort: 'displayName', size: 20 })
    expect(result.current.table.state).toMatchObject({ page: 0, size: 20, sort: 'displayName', dir: 'asc' })
    expect(result.current.table.params).toEqual({ page: 0, size: 20, sort: 'displayName,asc' })
  })

  it('reads page, size and sort back out of the address bar', () => {
    const { result } = setup('/employees?page=3&size=50&sort=hireDate&dir=desc', { defaultSort: 'displayName' })
    expect(result.current.table.state).toMatchObject({ page: 3, size: 50, sort: 'hireDate', dir: 'desc' })
    expect(result.current.table.params.sort).toBe('hireDate,desc')
  })

  it('writes a page change to the address bar so the view is shareable', () => {
    const { result } = setup()
    act(() => result.current.table.setPage(2))
    expect(result.current.location.search).toContain('page=2')
    expect(result.current.table.state.page).toBe(2)
  })

  it('leaves default values out of the address bar', () => {
    const { result } = setup('/employees?page=2', { defaultSort: 'displayName', size: 20 })
    act(() => result.current.table.setPage(0))
    expect(result.current.location.search).not.toContain('page')
  })

  it('flips direction when the same column is sorted twice, and resets to ascending on a new one', () => {
    const { result } = setup('/employees', { defaultSort: 'displayName' })
    act(() => result.current.table.setSort('hireDate'))
    expect(result.current.table.state).toMatchObject({ sort: 'hireDate', dir: 'asc' })
    act(() => result.current.table.setSort('hireDate'))
    expect(result.current.table.state.dir).toBe('desc')
    act(() => result.current.table.setSort('displayName'))
    expect(result.current.table.state).toMatchObject({ sort: 'displayName', dir: 'asc' })
  })

  it('returns to the first page whenever the result set changes', () => {
    const { result } = setup('/employees?page=4')
    act(() => result.current.table.setSort('hireDate'))
    expect(result.current.table.state.page).toBe(0)

    act(() => result.current.table.setPage(4))
    act(() => result.current.table.setSize(50))
    expect(result.current.table.state.page).toBe(0)

    act(() => result.current.table.setPage(4))
    act(() => result.current.table.setQuery('ana'))
    expect(result.current.table.state.page).toBe(0)
  })

  it('debounces the search term so typing sends one request, not one per letter', async () => {
    const { result } = setup('/employees', { debounceMs: 20 })
    act(() => result.current.table.setQuery('ana'))
    expect(result.current.table.params.q).toBeUndefined()
    expect(result.current.table.searchPending).toBe(true)
    await waitFor(() => expect(result.current.table.params.q).toBe('ana'))
    expect(result.current.table.searchPending).toBe(false)
  })

  it('ignores a page size the server would reject', () => {
    const { result } = setup('/employees?size=9999', { size: 20 })
    expect(result.current.table.state.size).toBe(20)
  })

  it('keeps two tables on one page apart using a prefix', () => {
    const { result } = setup('/payruns/1?page=1&ps.page=7', { prefix: 'ps.' })
    expect(result.current.table.state.page).toBe(7)
    act(() => result.current.table.setPage(2))
    expect(result.current.location.search).toContain('ps.page=2')
    expect(result.current.location.search).toContain('page=1')
  })

  it('keeps state out of the address bar when a panel asks it to', () => {
    const { result } = setup('/payruns/1', { url: false })
    act(() => result.current.table.setPage(3))
    expect(result.current.table.state.page).toBe(3)
    expect(result.current.location.search).toBe('')
  })

  it('reset returns every parameter to its default', () => {
    const { result } = setup('/employees?page=3&size=50&q=ana&sort=hireDate&dir=desc', { defaultSort: 'displayName' })
    act(() => result.current.table.reset())
    expect(result.current.table.state).toMatchObject({ page: 0, size: 20, sort: 'displayName', dir: 'asc', q: '' })
    expect(result.current.location.search).toBe('')
  })
})
