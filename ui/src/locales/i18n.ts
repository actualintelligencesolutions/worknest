import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en/common.json';

void i18next.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  resources: {
    en: {
      common: en,
    },
  },
  defaultNS: 'common',
});

export default i18next;
