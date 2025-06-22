import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en_login from './locales/en/login.json';
import ru_login from './locales/ru/login.json';
import en_cards from './locales/en/cards.json';
import ru_cards from './locales/ru/cards.json';
import en_menu from './locales/en/menu.json';
import ru_menu from './locales/ru/menu.json';
import en_table_titles from './locales/en/table-titles.json';
import ru_table_titles from './locales/ru/table-titles.json';
import en_table_data from './locales/en/table.json';
import ru_table_data from './locales/ru/table.json';
import en_chart from './locales/en/chart.json';
import ru_chart from './locales/ru/chart.json';
import chart_data_ru from './locales/ru/chart-data.json';
import chart_data_en from './locales/en/chart-data.json';

import de_login from './locales/de/login.json';
import de_cards from './locales/de/cards.json';
import de_menu from './locales/de/menu.json';
import de_table_titles from './locales/de/table-titles.json';
import de_table_data from './locales/de/table.json';
import de_chart from './locales/de/chart.json';
import chart_data_de from './locales/de/chart-data.json';

import es_login from './locales/es/login.json';
import es_cards from './locales/es/cards.json';
import es_menu from './locales/es/menu.json';
import es_table_titles from './locales/es/table-titles.json';
import es_table_data from './locales/es/table.json';
import es_chart from './locales/es/chart.json';
import chart_data_es from './locales/es/chart-data.json';

import fr_login from './locales/fr/login.json';
import fr_cards from './locales/fr/cards.json';
import fr_menu from './locales/fr/menu.json';
import fr_table_titles from './locales/fr/table-titles.json';
import fr_table_data from './locales/fr/table.json';
import fr_chart from './locales/fr/chart.json';
import chart_data_fr from './locales/fr/chart-data.json';

import it_login from './locales/it/login.json';
import it_cards from './locales/it/cards.json';
import it_menu from './locales/it/menu.json';
import it_table_titles from './locales/it/table-titles.json';
import it_table_data from './locales/it/table.json';
import it_chart from './locales/it/chart.json';
import chart_data_it from './locales/it/chart-data.json';

import pt_login from './locales/pt/login.json';
import pt_cards from './locales/pt/cards.json';
import pt_menu from './locales/pt/menu.json';
import pt_table_titles from './locales/pt/table-titles.json';
import pt_table_data from './locales/pt/table.json';
import pt_chart from './locales/pt/chart.json';
import chart_data_pt from './locales/pt/chart-data.json';

declare global {
  interface Window {
    __GLOBAL_I18N_INSTANCE__: typeof i18n;
    __I18N_INITIALIZED__: boolean;
  }
}

export const defaultLanguage = "ru";

const resources = {
  en: {
    login: en_login,
    cards: en_cards,
    menu: en_menu,
    table_titles: en_table_titles,
    table_data: en_table_data,
    chart: en_chart,
    chart_data: chart_data_en
  },
  ru: {
    login: ru_login,
    cards: ru_cards,
    menu: ru_menu,
    table_titles: ru_table_titles,
    table_data: ru_table_data,
    chart: ru_chart,
    chart_data: chart_data_ru
  },
  de: {
    login: de_login,
    cards: de_cards,
    menu: de_menu,
    table_titles: de_table_titles,
    table_data: de_table_data,
    chart: de_chart,
    chart_data: chart_data_de
  },
  es: {
    login: es_login,
    cards: es_cards,
    menu: es_menu,
    table_titles: es_table_titles,
    table_data: es_table_data,
    chart: es_chart,
    chart_data: chart_data_es
  },
  fr: {
    login: fr_login,
    cards: fr_cards,
    menu: fr_menu,
    table_titles: fr_table_titles,
    table_data: fr_table_data,
    chart: fr_chart,
    chart_data: chart_data_fr
  },
  it: {
    login: it_login,
    cards: it_cards,
    menu: it_menu,
    table_titles: it_table_titles,
    table_data: it_table_data,
    chart: it_chart,
    chart_data: chart_data_it
  },
  pt: {
    login: pt_login,
    cards: pt_cards,
    menu: pt_menu,
    table_titles: pt_table_titles,
    table_data: pt_table_data,
    chart: pt_chart,
    chart_data: chart_data_pt
  }
};

// Синглетон-функция для получения i18n инстанса
const getI18nInstance = () => {
  // Проверяем, есть ли уже глобальный экземпляр
  if (typeof window !== 'undefined' && window.__GLOBAL_I18N_INSTANCE__) {
    return window.__GLOBAL_I18N_INSTANCE__;
  }

  // Создаем новый экземпляр только если его нет
  let i18nInstance;
  
  if (i18n.isInitialized) {
    i18nInstance = i18n;
  } else {
    i18nInstance = i18n.createInstance();
    
    i18nInstance
      .use(initReactI18next)
      .init({
        resources,
        lng: defaultLanguage,
        fallbackLng: defaultLanguage,
        interpolation: {
          escapeValue: false
        },
        react: {
          useSuspense: false
        }
      });
  }

  // Сохраняем в window для доступа из всех микрофронтендов
  if (typeof window !== 'undefined') {
    window.__GLOBAL_I18N_INSTANCE__ = i18nInstance;
    window.__I18N_INITIALIZED__ = true;
  }

  return i18nInstance;
};

// Инициализируем синглетон
const i18nSingleton = getI18nInstance();

export default i18nSingleton;

// Экспортируем функцию для получения экземпляра из других микрофронтендов
export { getI18nInstance };