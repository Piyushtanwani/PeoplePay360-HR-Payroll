import * as React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { DataTable, TablePagination, type Column } from './DataTable'
import { useTableState } from '@/lib/hooks/useTableState'

interface Person { id: number; name: string; department: string; paid: boolean }

const PEOPLE: Person[] = [
  { id: 1, name: 'Ana Silva', department: 'Engineering', paid: false },
  { id: 2, name: 'Ben Okoro', department: 'Finance', paid: true },
  { id: 3, name: 'Cara Diaz', department: 'Engineering', paid: false },
]

const COLUMNS: Column<Person>[] = [
  { key: 'name', header: 'Name', render: (r) => r.name, sortable: true, sortValue: (r) => r.name },
  { key: 'department', header: 'Department', render: (r) => r.department, sortable: true },
]

const EMPTY = { title: 'No people', description: 'Add someone to see them here.' }

/** The table reads and writes the address bar through its controller, so a router is required. */
function Harness(props: { children: React.ReactNode; at?: string }) {
  return <MemoryRouter initialEntries={[props.at ?? '/people']}>{props.children}</MemoryRouter>
}

/** A server-mode table wired to a real controller, which is how every page uses it. */
function ServerTable(props: Partial<React.ComponentProps<typeof DataTable<Person>>> & { total?: number }) {
  const table = useTableState({ defaultSort: 'name' })
  return <DataTable rows={PEOPLE} columns={COLUMNS} empty={EMPTY} table={table} total={props.total ?? 143} {...props} />
}

describe('DataTable', () => {
  it('renders one row per record with the columns given', () => {
    render(<Harness><ServerTable /></Harness>)
    expect(screen.getAllByRole('row')).toHaveLength(PEOPLE.length + 1)
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Department/ })).toBeInTheDocument()
  })

  it('explains an empty list instead of showing a blank panel', () => {
    render(<Harness><ServerTable rows={[]} total={0} /></Harness>)
    expect(screen.getByText('No people')).toBeInTheDocument()
    expect(screen.getByText('Add someone to see them here.')).toBeInTheDocument()
  })

  it('states which rows of how many are on screen', () => {
    render(<Harness at="/people?page=1&size=20"><ServerTable /></Harness>)
    expect(screen.getByText(/Showing 21–23 of 143/)).toBeInTheDocument()
    expect(screen.getByText(/Page 2 of 8/)).toBeInTheDocument()
  })

  it('sends the sort to the server and marks the sorted column', async () => {
    const user = userEvent.setup()
    render(<Harness><ServerTable /></Harness>)
    await user.click(screen.getByRole('button', { name: 'Department' }))
    expect(screen.getByRole('columnheader', { name: /Department/ })).toHaveAttribute('aria-sort', 'ascending')
    await user.click(screen.getByRole('button', { name: 'Department' }))
    expect(screen.getByRole('columnheader', { name: /Department/ })).toHaveAttribute('aria-sort', 'descending')
  })

  it('disables the previous control on the first page and the next control on the last', () => {
    const { unmount } = render(<Harness><ServerTable /></Harness>)
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()
    unmount()

    render(<Harness at="/people?page=7"><ServerTable /></Harness>)
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  // The regression: the header checkbox used to compare against every row, so a table with any
  // disabled row could never read as fully selected. The payrun wizard is exactly that table.
  it('reads as fully selected once every selectable row is selected, even with rows that cannot be chosen', async () => {
    const user = userEvent.setup()
    const onSelectionChange = vi.fn()
    render(
      <Harness>
        <ServerTable
          selectable
          rowDisabled={(row: Person) => row.paid}
          selectedIds={new Set([1, 3])}
          onSelectionChange={onSelectionChange}
        />
      </Harness>,
    )
    const header = within(screen.getAllByRole('row')[0]).getByRole('checkbox')
    expect(header).toBeChecked()

    // Selecting all must offer only the rows a person is allowed to choose.
    await user.click(header)
    expect(onSelectionChange).toHaveBeenCalledWith(new Set())
  })

  it('selects only the rows that are not disabled', async () => {
    const user = userEvent.setup()
    const onSelectionChange = vi.fn()
    render(
      <Harness>
        <ServerTable
          selectable
          rowDisabled={(row: Person) => row.paid}
          selectedIds={new Set()}
          onSelectionChange={onSelectionChange}
        />
      </Harness>,
    )
    await user.click(within(screen.getAllByRole('row')[0]).getByRole('checkbox'))
    expect(onSelectionChange).toHaveBeenCalledWith(new Set([1, 3]))
  })

  it('filters locally when the caller gives search keys instead of a controller', async () => {
    const user = userEvent.setup()
    render(
      <Harness>
        <DataTable
          rows={PEOPLE}
          columns={COLUMNS}
          empty={EMPTY}
          searchKeys={[(r) => r.name]}
          toolbar={{ search: 'Search people' }}
        />
      </Harness>,
    )
    await user.type(screen.getByRole('searchbox', { name: 'Search people' }), 'ana')
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.queryByText('Ben Okoro')).not.toBeInTheDocument()
  })

  it('drops a column the caller may not see', () => {
    render(
      <Harness>
        <ServerTable columns={[...COLUMNS, { key: 'pay', header: 'Net pay', render: () => '—', hidden: true }]} />
      </Harness>,
    )
    expect(screen.queryByRole('columnheader', { name: /Net pay/ })).not.toBeInTheDocument()
  })

  it('reports a failure with a way to retry rather than an empty list', () => {
    const onRetry = vi.fn()
    render(<Harness><ServerTable rows={[]} error={{ detail: 'The server did not answer.' }} onRetry={onRetry} /></Harness>)
    expect(screen.getByText('The server did not answer.')).toBeInTheDocument()
  })
})

describe('DataTable driven locally by a controller', () => {
  /** A controller with no `total`: the caller holds every row, as the departments list does. */
  function LocalTable(props: Partial<React.ComponentProps<typeof DataTable<Person>>> = {}) {
    const table = useTableState({ url: false, defaultSort: 'name', size: 20 })
    return (
      <DataTable
        rows={PEOPLE}
        columns={COLUMNS}
        empty={EMPTY}
        table={table}
        searchKeys={[(r) => r.name]}
        toolbar={{ search: 'Search people' }}
        {...props}
      />
    )
  }

  it('counts the rows it was given, with the same footer as a server-paged list', () => {
    render(<Harness><LocalTable /></Harness>)
    expect(screen.getByText(/Showing 1–3 of 3/)).toBeInTheDocument()
  })

  it('filters locally through the controller, which server mode used to swallow', async () => {
    const user = userEvent.setup()
    render(<Harness><LocalTable /></Harness>)
    await user.type(screen.getByRole('searchbox', { name: 'Search people' }), 'ana')
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.queryByText('Ben Okoro')).not.toBeInTheDocument()
    expect(screen.getByText(/Showing 1–1 of 1/)).toBeInTheDocument()
  })

  it('sorts locally through the controller', async () => {
    const user = userEvent.setup()
    render(<Harness><LocalTable /></Harness>)
    await user.click(screen.getByRole('button', { name: 'Name' }))
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'descending')
    const first = within(screen.getAllByRole('row')[1]).getAllByRole('cell')[0]
    expect(first).toHaveTextContent('Cara Diaz')
  })

  it('pages locally, showing only one page of rows at a time', async () => {
    const user = userEvent.setup()
    const many = Array.from({ length: 45 }, (_, i) => ({
      id: i + 1, name: `Person ${String(i + 1).padStart(2, '0')}`, department: 'Engineering', paid: false,
    }))
    render(<Harness><LocalTable rows={many} /></Harness>)
    expect(screen.getAllByRole('row')).toHaveLength(21)
    expect(screen.getByText(/Showing 1–20 of 45/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText(/Showing 21–40 of 45/)).toBeInTheDocument()
  })
})

describe('TablePagination', () => {
  const noop = () => {}

  it('counts from one, not zero', () => {
    render(<TablePagination page={0} size={20} total={143} shownOnPage={20} paged onPage={noop} onSize={noop} />)
    expect(screen.getByText(/Showing 1–20 of 143/)).toBeInTheDocument()
  })

  it('shows a short final page correctly', () => {
    render(<TablePagination page={7} size={20} total={143} shownOnPage={3} paged onPage={noop} onSize={noop} />)
    expect(screen.getByText(/Showing 141–143 of 143/)).toBeInTheDocument()
    expect(screen.getByText(/Page 8 of 8/)).toBeInTheDocument()
  })

  it('shows zero rather than one when nothing matched', () => {
    render(<TablePagination page={0} size={20} total={0} shownOnPage={0} paged onPage={noop} onSize={noop} />)
    expect(screen.getByText(/Showing 0–0 of 0/)).toBeInTheDocument()
  })
})
