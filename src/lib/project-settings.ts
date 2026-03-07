import mockProject from '../data/mock-project.json'

const PROJECT_SETTINGS_KEY = 'pys_project_settings'
const PROJECT_SETTINGS_CHANGED_EVENT = 'pys-project-settings-changed'

type MockProject = {
  defaultName: string
  defaultLogo: string
  defaultGoogleMapsApiKey?: string
  defaultPaymentCurrency?: string
  defaultContractSubjectTemplate?: string
  defaultContractEconomicClausesTemplate?: string
  defaultContractServicesAdjustmentTemplate?: string
  defaultContractSpecialClausesFormula?: string
  defaultContractSpecialClauses?: Array<{
    id: string
    title: string
    text: string
    isActive?: boolean
  }>
}

export type ProjectSettings = {
  projectName: string
  logoUrl: string
  googleMapsApiKey: string
  paymentCurrency: string
  avatarDicebearStyle: string
  contractSubjectTemplate: string
  contractEconomicClausesTemplate: string
  contractServicesAdjustmentTemplate: string
  contractSpecialClausesFormula: string
  contractSpecialClauses: ContractSpecialClause[]
  homepageSliderEnabledContentTypes: SliderContentType[]
  homepageSliderItems: HomepageSliderItem[]
}

export type ContractSpecialClause = {
  id: string
  title: string
  text: string
  isActive: boolean
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
    avatarDicebearStyle: 'initials',
    contractSubjectTemplate:
      projectDefaults.defaultContractSubjectTemplate ??
      '<p>Con il presente contratto {{company_title}} eroga il servizio sportivo relativo al pacchetto {{package_name}} (edizione {{package_edition_year}}), periodo {{package_period}}, presso {{training_address}}.</p>',
    contractEconomicClausesTemplate:
      projectDefaults.defaultContractEconomicClausesTemplate ??
      '<p>Inserisci qui le clausole economiche ufficiali (rate, ritardi, sospensioni, rimborsi, recesso).</p>',
    contractServicesAdjustmentTemplate:
      projectDefaults.defaultContractServicesAdjustmentTemplate ??
      '<p>Inserisci qui le clausole su servizi fissi/variabili e conguagli post-validazione.</p>',
    contractSpecialClausesFormula:
      projectDefaults.defaultContractSpecialClausesFormula ??
      '<p>Ai sensi e per gli effetti degli articoli 1341 e 1342 c.c., il contraente dichiara di aver letto, compreso e approvato specificamente le clausole sotto richiamate.</p>',
    contractSpecialClauses:
      (projectDefaults.defaultContractSpecialClauses ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        text: item.text,
        isActive: item.isActive ?? true,
      })),
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
    avatarDicebearStyle:
      typeof stored.avatarDicebearStyle === 'string' && stored.avatarDicebearStyle.trim()
        ? stored.avatarDicebearStyle.trim()
        : defaults.avatarDicebearStyle,
    contractSubjectTemplate:
      typeof stored.contractSubjectTemplate === 'string' && stored.contractSubjectTemplate.trim()
        ? stored.contractSubjectTemplate
        : defaults.contractSubjectTemplate,
    contractEconomicClausesTemplate:
      typeof stored.contractEconomicClausesTemplate === 'string' && stored.contractEconomicClausesTemplate.trim()
        ? stored.contractEconomicClausesTemplate
        : defaults.contractEconomicClausesTemplate,
    contractServicesAdjustmentTemplate:
      typeof stored.contractServicesAdjustmentTemplate === 'string' && stored.contractServicesAdjustmentTemplate.trim()
        ? stored.contractServicesAdjustmentTemplate
        : defaults.contractServicesAdjustmentTemplate,
    contractSpecialClausesFormula:
      typeof stored.contractSpecialClausesFormula === 'string' && stored.contractSpecialClausesFormula.trim()
        ? stored.contractSpecialClausesFormula
        : defaults.contractSpecialClausesFormula,
    contractSpecialClauses: Array.isArray(stored.contractSpecialClauses)
      ? stored.contractSpecialClauses
          .map((item): ContractSpecialClause | null => {
            if (!item || typeof item !== 'object') {
              return null
            }
            const typed = item as Partial<ContractSpecialClause>
            if (
              typeof typed.id !== 'string' ||
              typed.id.trim().length === 0 ||
              typeof typed.title !== 'string' ||
              typed.title.trim().length === 0 ||
              typeof typed.text !== 'string' ||
              typed.text.trim().length === 0
            ) {
              return null
            }
            return {
              id: typed.id,
              title: typed.title.trim(),
              text: typed.text,
              isActive: typed.isActive ?? true,
            }
          })
          .filter((item): item is ContractSpecialClause => Boolean(item))
      : defaults.contractSpecialClauses,
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

export function setAvatarDicebearStyle(style: string): void {
  const normalized = style.trim() || 'initials'
  const settings = getProjectSettings()
  writeSettings({ ...settings, avatarDicebearStyle: normalized })
}

export function getProjectSettingsChangedEventName(): string {
  return PROJECT_SETTINGS_CHANGED_EVENT
}
