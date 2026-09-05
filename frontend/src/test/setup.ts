import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(cleanup)

/**
 * Web storage, which this jsdom build does not provide.
 *
 * The application remembers small preferences here (which employee view was last used, whether the
 * chat rail is open), so a page that reads storage crashes without it. Cleared between tests so one
 * test's preference cannot decide another's starting state.
 */
class MemoryStorage implements Storage {
  private entries = new Map<string, string>()
  get length() { return this.entries.size }
  clear() { this.entries.clear() }
  getItem(key: string) { return this.entries.get(key) ?? null }
  key(index: number) { return Array.from(this.entries.keys())[index] ?? null }
  removeItem(key: string) { this.entries.delete(key) }
  setItem(key: string, value: string) { this.entries.set(key, String(value)) }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (!(name in globalThis) || !globalThis[name]) {
    Object.defineProperty(globalThis, name, { value: new MemoryStorage(), writable: true })
  }
}

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

// jsdom implements neither of these, and Radix and the shared table both call them on mount.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})) as typeof window.matchMedia

window.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Element.prototype.scrollIntoView ??= vi.fn()
// jsdom lays nothing out, so it implements neither scroll method.
Element.prototype.scrollTo ??= vi.fn()
Element.prototype.hasPointerCapture ??= (() => false) as Element['hasPointerCapture']
Element.prototype.setPointerCapture ??= vi.fn()
Element.prototype.releasePointerCapture ??= vi.fn()
