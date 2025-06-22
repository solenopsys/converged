import { useEffect, useState } from 'react';
// Хук который работает только с нашим глобальным экземпляром
export const useGlobalTranslation = (namespace?: string) => {
  const [ready, setReady] = useState(false);
  const [i18nInstance, setI18nInstance] = useState<any>(null);
  const [language, setLanguage] = useState('ru');

  useEffect(() => {
    // Ждем инициализации глобального i18n
    const checkI18n = () => {
      if (typeof window !== 'undefined' && window.__GLOBAL_I18N_INSTANCE__) {
        const instance = window.__GLOBAL_I18N_INSTANCE__;
        setI18nInstance(instance);
        setLanguage(instance.language);
        setReady(true);

        // Слушаем изменения языка
        const handleLanguageChange = (lng: string) => {
          setLanguage(lng);
        };
        
        instance.on('languageChanged', handleLanguageChange);
        
        return () => {
          instance.off('languageChanged', handleLanguageChange);
        };
      } else {
        setTimeout(checkI18n, 50);
      }
    };
    
    const cleanup = checkI18n();
    return cleanup;
  }, []);

  // Кастомная функция t БЕЗ использования react-i18next
  const t = (key: string, fallback?: string, options?: any) => {
    if (!ready || !i18nInstance) return fallback || key;
    
    const fullKey = namespace ? `${namespace}:${key}` : key;
    const result = i18nInstance.t(fullKey, options);
    
    // Если перевод не найден и есть fallback, возвращаем fallback
    return result === fullKey && fallback ? fallback : result;
  };

  // Создаем ФЕЙКОВЫЙ i18n объект который никогда не null
  const safeI18n = {
    // Основные свойства
    language: language,
    languages: i18nInstance?.languages || ['ru'],
    
    // Безопасные методы
    getResource: (lng: string, ns: string, key?: string) => {
      if (!ready || !i18nInstance) return null;
      return i18nInstance.getResource(lng, ns, key);
    },
    
    changeLanguage: (lng: string) => {
      if (!ready || !i18nInstance) return Promise.resolve();
      return i18nInstance.changeLanguage(lng);
    },
    
    t: (key: string, options?: any) => {
      if (!ready || !i18nInstance) return key;
      return i18nInstance.t(key, options);
    },

    // Остальные методы из реального экземпляра
    ...(i18nInstance || {})
  };

  return {
    t, // Наша кастомная функция t
    i18n: safeI18n, // ВСЕГДА объект, никогда не null!
    ready: ready && !!i18nInstance,
    // Дополнительные свойства как в useTranslation
    ready: ready
  };
};

// Альтернативный простой хук без React
export const useSimpleTranslation = () => {
  const i18nInstance = typeof window !== 'undefined' ? window.__GLOBAL_I18N_INSTANCE__ : null;
  
  const t = (key: string, options?: any) => {
    if (!i18nInstance) return key;
    return i18nInstance.t(key, options);
  };

  const getResource = (lng: string, ns: string, key?: string) => {
    if (!i18nInstance) return null;
    return i18nInstance.getResource(lng, ns, key);
  };

  const changeLanguage = (lng: string) => {
    if (i18nInstance) {
      return i18nInstance.changeLanguage(lng);
    }
    return Promise.resolve();
  };

  return {
    t,
    getResource,
    changeLanguage,
    i18n: i18nInstance,
    ready: !!i18nInstance
  };
};