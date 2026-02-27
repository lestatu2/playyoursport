import mockUi from '../data/mock-ui.json'

const THEME_KEY = 'pys_ui_theme'

type MockThemeData = {
  themes: string[]
  defaultTheme: string
}

const themeData = mockUi as MockThemeData

function writeThemeToDom(theme: string): void {
  document.documentElement.setAttribute('data-theme', theme)
  if (document.body) {
    document.body.setAttribute('data-theme', theme)
  }
  const root = document.getElementById('root')
  if (root) {
    root.setAttribute('data-theme', theme)
  }
}

export function getAvailableThemes(): string[] {
  return themeData.themes
}

export function getDefaultTheme(): string {
  return themeData.defaultTheme
}

export function getStoredTheme(): string {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored && getAvailableThemes().includes(stored)) {
      return stored
    }
  } catch {
    return getDefaultTheme()
  }
  return getDefaultTheme()
}

export function applyTheme(theme: string): boolean {
  if (!getAvailableThemes().includes(theme)) {
    return false
  }
  writeThemeToDom(theme)
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    return false
  }
  return true
}

export function initializeTheme(): void {
  applyTheme(getStoredTheme())
}
