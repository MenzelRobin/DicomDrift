import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enCommon from './en/common.json'
import enLanding from './en/landing.json'
import enViewer from './en/viewer.json'
import enProcessing from './en/processing.json'

import deCommon from './de/common.json'
import deLanding from './de/landing.json'
import deViewer from './de/viewer.json'
import deProcessing from './de/processing.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        landing: enLanding,
        viewer: enViewer,
        processing: enProcessing,
      },
      de: {
        common: deCommon,
        landing: deLanding,
        viewer: deViewer,
        processing: deProcessing,
      },
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'landing', 'viewer', 'processing'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

export default i18n
