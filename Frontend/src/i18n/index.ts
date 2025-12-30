import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ar from './locales/ar.json'
import { appConfig } from '../config/app.config'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    lng: localStorage.getItem('language') || appConfig.i18n.defaultLanguage,
    fallbackLng: appConfig.i18n.defaultLanguage,
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
