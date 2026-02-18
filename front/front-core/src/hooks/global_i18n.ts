// useGlobalTranslation.ts
import { useEffect, useState, useCallback } from 'react';
import { initI18n } from '../i18n';

// Типы для безопасности
interface I18nInstance {
  language: string;
  languages: string[];
  t: (key: string, options?: any) => string;
  getResource: (lng: string, ns: string, key?: string) => any;
  changeLanguage: (lng: string) => Promise<void>;
  on: (event: string, callback: (lng: string) => void) => void;
  off: (event: string, callback: (lng: string) => void) => void;
  hasLoadedNamespace: (ns: string, lng?: string) => boolean;
  isInitialized: boolean;
}

declare global {
  interface Window {
    __GLOBAL_I18N_INSTANCE__?: I18nInstance;
    __I18N_INIT_PROMISE__?: Promise<I18nInstance>;
  }
}

// Основной хук с полной поддержкой состояния
export const useGlobalTranslation = (namespace?: string) => {
  const [ready, setReady] = useState(false);
  const [i18nInstance, setI18nInstance] = useState<I18nInstance | null>(null);
  const [language, setLanguage] = useState('en');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | undefined;

    const setupI18n = async () => {
      try {
        // Используем промис инициализации или создаем новый
        const instance = await (window.__I18N_INIT_PROMISE__ || initI18n());
        
        if (!mounted) return;

        // Проверяем, что namespace загружен (если указан)
        if (namespace) {
          const isNamespaceLoaded = instance.hasLoadedNamespace(namespace, instance.language);
          
          if (!isNamespaceLoaded) {
            // Пытаемся загрузить namespace
            await new Promise<void>((resolve) => {
              const checkNamespace = () => {
                if (instance.hasLoadedNamespace(namespace, instance.language)) {
                  resolve();
                } else {
                  setTimeout(checkNamespace, 100);
                }
              };
              checkNamespace();
            });
          }
        }

        setI18nInstance(instance);
        setLanguage(instance.language);
        setReady(true);
        setLoadError(null);

        // Обработчик изменения языка
        const handleLanguageChange = (lng: string) => {
          setLanguage(lng);
        };

        // Обработчик загрузки новых namespace
        const handleLoaded = () => {
          if (namespace && instance.hasLoadedNamespace(namespace, instance.language)) {
            setReady(true);
          }
        };
        
        // Подписка на события
        if (instance.on && instance.off) {
          instance.on('languageChanged', handleLanguageChange);
          instance.on('loaded', handleLoaded);
          
          cleanup = () => {
            instance.off('languageChanged', handleLanguageChange);
            instance.off('loaded', handleLoaded);
          };
        }
      } catch (error) {
        if (!mounted) return;
        
        console.error('Failed to initialize i18n:', error);
        setLoadError('Failed to load translations');
        
        // Fallback: пытаемся использовать существующий экземпляр
        if (window.__GLOBAL_I18N_INSTANCE__) {
          setI18nInstance(window.__GLOBAL_I18N_INSTANCE__);
          setLanguage(window.__GLOBAL_I18N_INSTANCE__.language);
          setReady(true);
        }
      }
    };
    
    setupI18n();
    
    // Очистка ресурсов
    return () => {
      mounted = false;
      if (cleanup) {
        cleanup();
      }
    };
  }, [namespace]);

  // Функция перевода с поддержкой namespace и fallback
  const t = useCallback((key: string, fallback?: string, options?: any) => {
    if (!ready || !i18nInstance) {
      return fallback || key;
    }
    
    // Формируем полный ключ с namespace
    const fullKey = namespace ? `${namespace}:${key}` : key;
    const result = i18nInstance.t(fullKey, options);
    
    // Проверяем, найден ли перевод
    const isKeyMissing = result === fullKey || result === key;
    
    // Возврат fallback если перевод не найден
    return isKeyMissing && fallback ? fallback : result;
  }, [ready, i18nInstance, namespace]);

  // Безопасный объект i18n
  const safeI18n = {
    language,
    languages: i18nInstance?.languages || ['ru', 'en'],
    
    getResource: (lng: string, ns: string, key?: string) => {
      return i18nInstance?.getResource(lng, ns, key) || null;
    },
    
    changeLanguage: async (lng: string) => {
      if (i18nInstance?.changeLanguage) {
        try {
          await i18nInstance.changeLanguage(lng);
        } catch (error) {
          console.error('Failed to change language:', error);
        }
      }
    },
    
    t: (key: string, options?: any) => {
      return i18nInstance?.t(key, options) || key;
    },
    
    hasLoadedNamespace: (ns: string, lng?: string) => {
      return i18nInstance?.hasLoadedNamespace(ns, lng) || false;
    }
  };

  return {
    t,
    i18n: safeI18n,
    ready: ready && !!i18nInstance,
    error: loadError
  };
};

// Упрощенный хук для SSR и быстрого доступа
export const useSimpleTranslation = (namespace?: string) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Проверяем готовность i18n
    const checkReady = async () => {
      try {
        const instance = await (window.__I18N_INIT_PROMISE__ || initI18n());
        
        if (namespace) {
          // Ждем загрузки namespace
          if (!instance.hasLoadedNamespace(namespace)) {
            await new Promise<void>((resolve) => {
              const check = () => {
                if (instance.hasLoadedNamespace(namespace)) {
                  resolve();
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            });
          }
        }
        
        setIsReady(true);
      } catch (error) {
        console.error('Failed to check i18n readiness:', error);
      }
    };

    checkReady();
  }, [namespace]);

  const getI18nInstance = (): I18nInstance | null => {
    return (typeof window !== 'undefined' && window.__GLOBAL_I18N_INSTANCE__) || null;
  };

  const t = useCallback((key: string, options?: any): string => {
    const instance = getI18nInstance();
    if (!instance) return key;
    
    const fullKey = namespace ? `${namespace}:${key}` : key;
    return instance.t(fullKey, options) || key;
  }, [namespace]);

  const getResource = useCallback((lng: string, ns: string, key?: string) => {
    const instance = getI18nInstance();
    return instance?.getResource(lng, ns, key) || null;
  }, []);

  const changeLanguage = useCallback(async (lng: string): Promise<void> => {
    const instance = getI18nInstance();
    if (instance?.changeLanguage) {
      try {
        await instance.changeLanguage(lng);
      } catch (error) {
        console.error('Failed to change language:', error);
      }
    }
  }, []);

  const i18nInstance = getI18nInstance();

  return {
    t,
    getResource,
    changeLanguage,
    i18n: i18nInstance,
    ready: isReady && !!i18nInstance
  };
};

// Хук для предзагрузки namespace
export const useNamespacePreload = (namespaces: string | string[]) => {
  const [loaded, setLoaded] = useState(false);
  
  useEffect(() => {
    const preload = async () => {
      try {
        const instance = await (window.__I18N_INIT_PROMISE__ || initI18n());
        const nsArray = Array.isArray(namespaces) ? namespaces : [namespaces];
        
        // Загружаем все namespace
        await Promise.all(
          nsArray.map(ns => 
            new Promise<void>((resolve) => {
              if (instance.hasLoadedNamespace(ns)) {
                resolve();
              } else {
                const check = () => {
                  if (instance.hasLoadedNamespace(ns)) {
                    resolve();
                  } else {
                    setTimeout(check, 50);
                  }
                };
                check();
              }
            })
          )
        );
        
        setLoaded(true);
      } catch (error) {
        console.error('Failed to preload namespaces:', error);
      }
    };
    
    preload();
  }, [namespaces]);
  
  return loaded;
};

import { LocaleController } from "../controllers/locale-controller";
 
export const useMicrofrontendTranslation = (microfrontendId: string) => {
  const { i18n } = useGlobalTranslation();
  const [translations, setTranslations] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const localeController = LocaleController.getInstance();

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const locales = localeController.getLocales(microfrontendId)
        console.log("Loading locales:", locales, i18n.language);
        
        const jsonUrl = locales[i18n.language];
        console.log("Loading from:", jsonUrl);
        
        const response = await fetch(jsonUrl);
        if (response.ok) {
          const data = await response.json();
          setTranslations(data);
        }
      } catch (error) {
        console.error('Failed to load translations:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTranslations();
  }, [i18n.language]);

  const t = (key: string) => {
    if (!key) return translations; // Возвращаем все переводы если ключ пустой
    
    const keys = key.split('.');
    let value = translations;
    console.log("Translating key:", key, "with value:", value);
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // Возвращаем ключ если путь не найден
      }
    }
    
    // ИСПРАВЛЕНИЕ: возвращаем найденное значение независимо от типа
    return value !== undefined ? value : key;
  };

  return { t, translations, loading };
};

export const translateJson = (json, t) => {
  if (typeof json === 'string' && /^[a-zA-Z][a-zA-Z0-9_.]+$/.test(json)) {
    return t(json);
  }
  if (Array.isArray(json)) {
    return json.map(item => translateJson(item, t));
  }
  if (json && typeof json === 'object') {
    const result = {};
    for (const key in json) {
      result[key] = translateJson(json[key], t);
    }
    return result;
  }
  return json;
 };