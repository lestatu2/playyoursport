import mockProject from '../data/mock-project.json'

const PROJECT_SETTINGS_KEY = 'pys_project_settings'
const PROJECT_SETTINGS_CHANGED_EVENT = 'pys-project-settings-changed'

type MockProject = {
  defaultName: string
  defaultLogo: string
}

export type ProjectSettings = {
  projectName: string
  logoUrl: string
}

const projectDefaults = mockProject as MockProject

function emitProjectSettingsChanged(): void {
  window.dispatchEvent(new Event(PROJECT_SETTINGS_CHANGED_EVENT))
}

function readStoredSettings(): Partial<ProjectSettings> {
  try {
    const value = localStorage.getItem(PROJECT_SETTINGS_KEY)
    return value ? (JSON.parse(value) as Partial<ProjectSettings>) : {}
  } catch {
    return {}
  }
}

function writeSettings(settings: ProjectSettings): void {
  localStorage.setItem(PROJECT_SETTINGS_KEY, JSON.stringify(settings))
  emitProjectSettingsChanged()
}

export function getDefaultProjectSettings(): ProjectSettings {
  return {
    projectName: projectDefaults.defaultName,
    logoUrl: projectDefaults.defaultLogo,
  }
}

export function getProjectSettings(): ProjectSettings {
  const defaults = getDefaultProjectSettings()
  const stored = readStoredSettings()
  return {
    projectName: stored.projectName?.trim() ? stored.projectName : defaults.projectName,
    logoUrl: stored.logoUrl ?? defaults.logoUrl,
  }
}

export function setProjectName(name: string): boolean {
  const normalizedName = name.trim()
  if (!normalizedName) {
    return false
  }
  const settings = getProjectSettings()
  writeSettings({ ...settings, projectName: normalizedName })
  return true
}

export function setProjectLogo(logoUrl: string): void {
  const settings = getProjectSettings()
  writeSettings({ ...settings, logoUrl })
}

export function clearProjectLogo(): void {
  const settings = getProjectSettings()
  writeSettings({ ...settings, logoUrl: '' })
}

export function getProjectSettingsChangedEventName(): string {
  return PROJECT_SETTINGS_CHANGED_EVENT
}
