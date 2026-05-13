import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import ar from './locales/ar.json';

i18n
 .use(LanguageDetector)
 .use(initReactI18next)
 .init({
 resources: {
 en: { translation: en },
 ar: { translation: ar }
 },
 fallbackLng: 'en',
 interpolation: {
 escapeValue: false, // not needed for react as it escapes by default
 }
 });

export default i18n;

// Enable Hot Reloading (HMR) for Vite
if (import.meta.hot) {
  import.meta.hot.accept('./locales/en.json', (newEn) => {
    if (newEn) {
      i18n.addResourceBundle('en', 'translation', newEn.default, true, true);
    }
  });
  import.meta.hot.accept('./locales/ar.json', (newAr) => {
    if (newAr) {
      i18n.addResourceBundle('ar', 'translation', newAr.default, true, true);
    }
  });
}
