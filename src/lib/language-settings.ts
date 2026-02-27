import mockLocales from '../data/mock-locales.json'
import { SUPPORTED_LANGUAGES, type LanguageCode } from './languages'

const LANGUAGE_SETTINGS_KEY = 'pys_language_settings'
const CURRENT_LANGUAGE_KEY = 'pys_current_language'
const LANGUAGE_SETTINGS_CHANGED_EVENT = 'pys-language-settings-changed'

type MockLocalesData = {
  primaryLanguage: LanguageCode
  activeLanguages: LanguageCode[]
}

export type LanguageSettings = {
  primaryLanguage: LanguageCode
  activeLanguages: LanguageCode[]
}

const defaults = mockLocales as MockLocalesData

function emitLanguageSettingsChanged(): void {
  window.dispatchEvent(new Event(LANGUAGE_SETTINGS_CHANGED_EVENT))
}

function isLanguageCode(value: string): value is LanguageCode {
  return SUPPORTED_LANGUAGES.includes(value as LanguageCode)
}

function sanitizeActiveLanguages(values: string[]): LanguageCode[] {
  const filtered = values.filter(isLanguageCode)
  const unique = Array.from(new Set(filtered))
  return unique.length > 0 ? unique : [defaults.primaryLanguage]
}

export function getLanguageSettingsChangedEventName(): string {
  return LANGUAGE_SETTINGS_CHANGED_EVENT
}

export function getLanguageSettings(): LanguageSettings {
  try {
    const raw = localStorage.getItem(LANGUAGE_SETTINGS_KEY)
    if (!raw) {
      return {
        primaryLanguage: defaults.primaryLanguage,
        activeLanguages: defaults.activeLanguages,
      }
    }

    const parsed = JSON.parse(raw) as Partial<LanguageSettings>
    const activeLanguages = sanitizeActiveLanguages(parsed.activeLanguages ?? defaults.activeLanguages)
    const primaryLanguage = isLanguageCode(parsed.primaryLanguage ?? '')
      ? (parsed.primaryLanguage as LanguageCode)
      : defaults.primaryLanguage

    if (!activeLanguages.includes(primaryLanguage)) {
      activeLanguages.unshift(primaryLanguage)
    }

    return { primaryLanguage, activeLanguages }
  } catch {
    return {
      primaryLanguage: defaults.primaryLanguage,
      activeLanguages: defaults.activeLanguages,
    }
  }
}

export function saveLanguageSettings(settings: LanguageSettings): LanguageSettings {
  const activeLanguages = sanitizeActiveLanguages(settings.activeLanguages)
  const primaryLanguage = activeLanguages.includes(settings.primaryLanguage)
    ? settings.primaryLanguage
    : activeLanguages[0]

  const next: LanguageSettings = { primaryLanguage, activeLanguages }
  localStorage.setItem(LANGUAGE_SETTINGS_KEY, JSON.stringify(next))
  emitLanguageSettingsChanged()
  return next
}

export function getCurrentLanguage(): LanguageCode {
  const settings = getLanguageSettings()
  try {
    const value = localStorage.getItem(CURRENT_LANGUAGE_KEY)
    if (value && isLanguageCode(value) && settings.activeLanguages.includes(value)) {
      return value
    }
  } catch {
    return settings.primaryLanguage
  }
  return settings.primaryLanguage
}

export function setCurrentLanguage(language: LanguageCode): LanguageCode {
  const settings = getLanguageSettings()
  const next = settings.activeLanguages.includes(language) ? language : settings.primaryLanguage
  localStorage.setItem(CURRENT_LANGUAGE_KEY, next)
  emitLanguageSettingsChanged()
  return next
}
