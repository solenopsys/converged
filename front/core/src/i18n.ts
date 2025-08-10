import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';

declare global {
  interface Window {
    __GLOBAL_I18N_INSTANCE__: typeof i18n;
    __I18N_INITIALIZED__: boolean;
  }
}

export const defaultLanguage = "en";

const namespaces = [
  'login',
  'cards',
  'menu',
  'table_titles',
  'table_data',
  'chart',
  'chart_data'
];

const namespaceFileMap = {
  'table_titles': 'table-titles',
  'table_data': 'table',
  'chart_data': 'chart-data'
};

const getI18nInstance = () => {
  if (typeof window !== 'undefined' && window.__GLOBAL_I18N_INSTANCE__) {
    return window.__GLOBAL_I18N_INSTANCE__;
  }

  let i18nInstance;
  
  if (i18n.isInitialized) {
    i18nInstance = i18n;
  } else {
    i18nInstance = i18n.createInstance();
    
    i18nInstance
      .use(HttpBackend)
      .use(initReactI18next)
      .init({
        lng: defaultLanguage,
        fallbackLng: defaultLanguage,
        ns: namespaces,
        defaultNS: 'login',
        interpolation: {
          escapeValue: false
        },
        react: {
          useSuspense: false
        },
        backend: {
          loadPath: (lngs, namespaces) => {
            const lng = lngs[0];
            const ns = namespaces[0];
            const filename = namespaceFileMap[ns] || ns;
            return `/locales/${lng}/${filename}.json`;
          }
        }
      });
  }

  if (typeof window !== 'undefined') {
    window.__GLOBAL_I18N_INSTANCE__ = i18nInstance;
    window.__I18N_INITIALIZED__ = true;
  }

  return i18nInstance;
};

const i18nSingleton = getI18nInstance();

export default i18nSingleton;

export { getI18nInstance };