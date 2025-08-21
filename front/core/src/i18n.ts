// i18n-config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';

declare global {
  interface Window {
    __GLOBAL_I18N_INSTANCE__: typeof i18n;
    __I18N_INITIALIZED__: boolean;
    __I18N_INIT_PROMISE__?: Promise<typeof i18n>;
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

const namespaceFileMap: Record<string, string> = {
  'table_titles': 'table-titles',
  'table_data': 'table',
  'chart_data': 'chart-data'
};

// Кеш промиса инициализации для избежания повторных инициализаций
let initPromise: Promise<typeof i18n> | null = null;

const initI18n = async (): Promise<typeof i18n> => {
  // Если уже инициализируется, возвращаем существующий промис
  if (initPromise) {
    return initPromise;
  }

  // Если уже инициализирован в window
  if (typeof window !== 'undefined' && window.__I18N_INITIALIZED__ && window.__GLOBAL_I18N_INSTANCE__) {
    return window.__GLOBAL_I18N_INSTANCE__;
  }

  initPromise = (async () => {
    let i18nInstance;
    
    // Проверяем, инициализирован ли уже i18n
    if (i18n.isInitialized && i18n.hasLoadedNamespace(namespaces[0])) {
      i18nInstance = i18n;
    } else {
      i18nInstance = i18n.createInstance();
      
      // Ожидаем завершения инициализации
      await i18nInstance
        .use(HttpBackend)
        .use(initReactI18next)
        .init({
          lng: defaultLanguage,
          fallbackLng: defaultLanguage,
          ns: namespaces,
          defaultNS: 'login',
          
          // Важно: загружаем все namespaces при инициализации
          preload: [defaultLanguage],
          
          interpolation: {
            escapeValue: false
          },
          
          react: {
            useSuspense: true,
            bindI18n: 'languageChanged loaded',
            bindI18nStore: 'added removed',
            transEmptyNodeValue: '',
            transSupportBasicHtmlNodes: true,
            transKeepBasicHtmlNodesFor: ['br', 'strong', 'i'],
          },
          
          backend: {
            loadPath: (lngs: string[], namespaces: string[]) => {
              const lng = lngs[0];
              const ns = namespaces[0];
              const filename = namespaceFileMap[ns] || ns;
              return `/locales/${lng}/${filename}.json`;
            },
            
            // Добавляем обработку ошибок
            requestOptions: {
              cache: 'default',
            },
            
            // Повторные попытки при ошибке
            reloadInterval: false,
            customHeaders: {},
            queryStringParams: {},
            crossDomain: false,
            withCredentials: false,
            overrideMimeType: false,
            
            // Таймаут для загрузки
            requestTimeout: 5000,
          },
          
          // Настройки для обработки загрузки
          load: 'languageOnly',
          cleanCode: true,
          
          // Обнаружение языка (опционально)
          detection: {
            order: ['localStorage', 'navigator', 'htmlTag'],
            caches: ['localStorage'],
            excludeCacheFor: ['cimode'],
          },
          
          // Дебаг для разработки
          debug: process.env.NODE_ENV === 'development',
        });
    }

    // Сохраняем в глобальный объект
    if (typeof window !== 'undefined') {
      window.__GLOBAL_I18N_INSTANCE__ = i18nInstance;
      window.__I18N_INITIALIZED__ = true;
      window.__I18N_INIT_PROMISE__ = initPromise;
    }

    return i18nInstance;
  })();

  return initPromise;
};

// Синхронный геттер (может вернуть неинициализированный экземпляр)
const getI18nInstance = (): typeof i18n => {
  if (typeof window !== 'undefined' && window.__GLOBAL_I18N_INSTANCE__) {
    return window.__GLOBAL_I18N_INSTANCE__;
  }
  
  // Возвращаем базовый i18n, но он может быть не готов
  return i18n;
};

// Асинхронный геттер (гарантирует инициализацию)
const getI18nInstanceAsync = async (): Promise<typeof i18n> => {
  return initI18n();
};

// Инициализируем при импорте модуля
const i18nSingleton = getI18nInstance();

// Запускаем инициализацию в фоне
if (typeof window !== 'undefined') {
  initI18n().catch(console.error);
}

export default i18nSingleton;
export { getI18nInstance, getI18nInstanceAsync, initI18n };