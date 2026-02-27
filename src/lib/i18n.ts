import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import de from '../locales/de.json'
import en from '../locales/en.json'
import es from '../locales/es.json'
import fr from '../locales/fr.json'
import it from '../locales/it.json'
import { getCurrentLanguage, getLanguageSettings } from './language-settings'

const settings = getLanguageSettings()
const initialLanguage = getCurrentLanguage()

void i18n.use(initReactI18next).init({
  resources: {
    it: { translation: it },
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    de: { translation: de },
  },
  lng: initialLanguage,
  fallbackLng: settings.primaryLanguage,
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
