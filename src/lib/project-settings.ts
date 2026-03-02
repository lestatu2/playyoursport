import mockProject from '../data/mock-project.json'

const PROJECT_SETTINGS_KEY = 'pys_project_settings'
const PROJECT_SETTINGS_CHANGED_EVENT = 'pys-project-settings-changed'

type MockProject = {
  defaultName: string
  defaultLogo: string
  defaultGoogleMapsApiKey?: string
  defaultPaymentCurrency?: string
}

export type ProjectSettings = {
  projectName: string
  logoUrl: string
  googleMapsApiKey: string
  paymentCurrency: string
  homepageSliderEnabledContentTypes: SliderContentType[]
  homepageSliderItems: HomepageSliderItem[]
}

export type SliderContentType = 'packages'

export type HomepageSliderItem = {
  id: string
  contentType: SliderContentType
  contentId: string
  isActive: boolean
  sortOrder: number
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
    googleMapsApiKey: projectDefaults.defaultGoogleMapsApiKey ?? '',
    paymentCurrency: projectDefaults.defaultPaymentCurrency ?? 'EUR',
    homepageSliderEnabledContentTypes: ['packages'],
    homepageSliderItems: [],
  }
}

export function getProjectSettings(): ProjectSettings {
  const defaults = getDefaultProjectSettings()
  const stored = readStoredSettings()
  return {
    projectName: stored.projectName?.trim() ? stored.projectName : defaults.projectName,
    logoUrl: stored.logoUrl ?? defaults.logoUrl,
    googleMapsApiKey: stored.googleMapsApiKey ?? defaults.googleMapsApiKey,
    paymentCurrency: typeof stored.paymentCurrency === 'string' && stored.paymentCurrency.trim()
      ? stored.paymentCurrency.trim().toUpperCase()
      : defaults.paymentCurrency,
    homepageSliderEnabledContentTypes:
      Array.isArray(stored.homepageSliderEnabledContentTypes) &&
      stored.homepageSliderEnabledContentTypes.includes('packages')
        ? ['packages']
        : defaults.homepageSliderEnabledContentTypes,
    homepageSliderItems: Array.isArray(stored.homepageSliderItems)
      ? stored.homepageSliderItems
          .map((item): HomepageSliderItem | null => {
            if (!item || typeof item !== 'object') {
              return null
            }
            const typed = item as Partial<HomepageSliderItem>
            if (
              typeof typed.id !== 'string' ||
              typed.id.trim().length === 0 ||
              typed.contentType !== 'packages' ||
              typeof typed.contentId !== 'string' ||
              typed.contentId.trim().length === 0
            ) {
              return null
            }
            return {
              id: typed.id,
              contentType: 'packages',
              contentId: typed.contentId,
              isActive: typed.isActive ?? true,
              sortOrder: Number.isFinite(typed.sortOrder) ? Number(typed.sortOrder) : 0,
            }
          })
          .filter((item): item is HomepageSliderItem => Boolean(item))
      : defaults.homepageSliderItems,
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

export function setHomepageSliderEnabledContentTypes(types: SliderContentType[]): void {
  const settings = getProjectSettings()
  const nextTypes: SliderContentType[] = types.includes('packages') ? ['packages'] : []
  writeSettings({
    ...settings,
    homepageSliderEnabledContentTypes: nextTypes,
  })
}

export function setHomepageSliderItems(items: HomepageSliderItem[]): void {
  const settings = getProjectSettings()
  writeSettings({
    ...settings,
    homepageSliderItems: items.map((item, index) => ({
      ...item,
      contentType: 'packages',
      sortOrder: Number.isFinite(item.sortOrder) ? item.sortOrder : index,
    })),
  })
}

export function setGoogleMapsApiKey(apiKey: string): void {
  const settings = getProjectSettings()
  writeSettings({ ...settings, googleMapsApiKey: apiKey.trim() })
}

export function setPaymentCurrency(currency: string): void {
  const normalized = currency.trim().toUpperCase() || 'EUR'
  const settings = getProjectSettings()
  writeSettings({ ...settings, paymentCurrency: normalized })
}

export function getProjectSettingsChangedEventName(): string {
  return PROJECT_SETTINGS_CHANGED_EVENT
}
