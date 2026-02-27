export const SUPPORTED_LANGUAGES = ['it', 'en', 'es', 'fr', 'de'] as const

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_META: Record<LanguageCode, { countryCode: 'IT' | 'GB' | 'ES' | 'FR' | 'DE'; shortLabel: string }> = {
  it: { countryCode: 'IT', shortLabel: 'IT' },
  en: { countryCode: 'GB', shortLabel: 'EN' },
  es: { countryCode: 'ES', shortLabel: 'ES' },
  fr: { countryCode: 'FR', shortLabel: 'FR' },
  de: { countryCode: 'DE', shortLabel: 'DE' },
}
