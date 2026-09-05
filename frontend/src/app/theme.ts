export type Theme = 'system' | 'light' | 'dark'
const KEY = 'pp360.theme'

export function readTheme(): Theme {
  try {
    return (localStorage.getItem(KEY) as Theme) ?? 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* private mode */
  }
}
