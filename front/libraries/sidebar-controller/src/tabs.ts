import type { SidebarTab } from "./types";
import { $sidebarTabs, $activeTab, tabActivated } from "./store";
import { getTabsContainer } from "./dom";

/** CSS классы для табов */
const CSS = {
  tab: "sidebar-tab",
  tabActive: "sidebar-tab--active",
  tabIcon: "sidebar-tab__icon",
  tabTitle: "sidebar-tab__title",
} as const;

/** Кэш созданных DOM элементов табов */
const tabElements = new Map<string, HTMLElement>();

/** Рендерер иконок (можно заменить извне) */
let iconRenderer: (iconName: string, container: HTMLElement) => void = (iconName, container) => {
  // Дефолтный рендер - просто текст
  container.textContent = iconName;
};

/** Установить кастомный рендерер иконок */
export const setIconRenderer = (renderer: (iconName: string, container: HTMLElement) => void) => {
  iconRenderer = renderer;
};

/** Создать DOM элемент таба */
const createTabElement = (tab: SidebarTab): HTMLElement => {
  const el = document.createElement("button");
  el.className = CSS.tab;
  el.setAttribute("data-tab-id", tab.id);
  el.type = "button";

  // Иконка
  if (tab.iconName) {
    const iconEl = document.createElement("span");
    iconEl.className = CSS.tabIcon;
    iconRenderer(tab.iconName, iconEl);
    el.appendChild(iconEl);
  }

  // Тайтл (для tooltip или accessibility)
  el.setAttribute("title", tab.title);
  el.setAttribute("aria-label", tab.title);

  // Клик активирует таб
  el.addEventListener("click", () => {
    tabActivated(tab.id);
  });

  return el;
};

/** Обновить активный класс на табах */
const updateActiveState = (activeId: string) => {
  tabElements.forEach((el, id) => {
    el.classList.toggle(CSS.tabActive, id === activeId);
  });
};

/** Синхронизировать табы с DOM */
const syncTabs = (tabs: SidebarTab[], container: HTMLElement) => {
  const currentIds = new Set(tabs.map((t) => t.id));

  // Удалить табы которых больше нет
  tabElements.forEach((el, id) => {
    if (!currentIds.has(id)) {
      el.remove();
      tabElements.delete(id);
    }
  });

  // Добавить новые табы
  tabs.forEach((tab) => {
    if (!tabElements.has(tab.id)) {
      const el = createTabElement(tab);
      tabElements.set(tab.id, el);
      container.appendChild(el);
    }
  });

  // Переупорядочить
  tabs.forEach((tab, index) => {
    const el = tabElements.get(tab.id);
    if (el && el.parentElement === container) {
      const currentIndex = Array.from(container.children).indexOf(el);
      if (currentIndex !== index) {
        if (index === 0) {
          container.prepend(el);
        } else {
          const prevEl = tabElements.get(tabs[index - 1]?.id);
          if (prevEl) {
            prevEl.after(el);
          }
        }
      }
    }
  });

  // Обновить активное состояние
  updateActiveState($activeTab.getState());
};

/** Listeners для очистки */
const listeners: Array<() => void> = [];

/** Инициализировать управление табами */
export const initTabs = () => {
  const container = getTabsContainer("left");
  if (!container) return;

  // Подписаться на изменения табов
  const unwatchTabs = $sidebarTabs.watch((tabs) => {
    syncTabs(tabs, container);
  });

  // Подписаться на изменение активного таба
  const unwatchActive = $activeTab.watch((activeId) => {
    updateActiveState(activeId);
  });

  listeners.push(unwatchTabs, unwatchActive);

  // Начальная синхронизация
  syncTabs($sidebarTabs.getState(), container);
};

/** Очистить */
export const destroyTabs = () => {
  listeners.forEach((fn) => fn());
  listeners.length = 0;
  tabElements.forEach((el) => el.remove());
  tabElements.clear();
};
