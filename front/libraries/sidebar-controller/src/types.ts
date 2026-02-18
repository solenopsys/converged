/** Сторона сайдбара */
export type SidebarSide = 'left' | 'right';

/** Состояние сайдбара */
export type SidebarState = 'expanded' | 'collapsed';

/** Таб в панели табов */
export interface SidebarTab {
  id: string;
  title: string;
  iconName?: string;
  order?: number;
}

/** Конфигурация сайдбара */
export interface SidebarConfig {
  side: SidebarSide;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  collapsible: boolean;
}

/** Селекторы DOM элементов */
export interface SidebarSelectors {
  /** Корневой элемент сайдбара */
  root: string;
  /** Кнопка toggle */
  trigger: string;
  /** Ресайзер */
  resizer: string;
  /** Контейнер табов */
  tabsContainer: string;
  /** Контейнер контента (куда монтируются панели) */
  contentContainer: string;
  /** Контейнер меню */
  menuContainer: string;
}

/** Опции инициализации контроллера */
export interface SidebarControllerOptions {
  left?: Partial<SidebarConfig>;
  right?: Partial<SidebarConfig>;
  selectors?: Partial<Record<SidebarSide, Partial<SidebarSelectors>>>;
  /** Сохранять состояние в storage */
  persist?: boolean;
  /** Ключ для storage */
  storageKey?: string;
}

/** Публичный API контроллера */
export interface SidebarControllerAPI {
  /** Инициализация - находит элементы и вешает listeners */
  init(): void;
  /** Очистка - снимает listeners */
  destroy(): void;

  /** Развернуть сайдбар */
  expand(side: SidebarSide): void;
  /** Свернуть сайдбар */
  collapse(side: SidebarSide): void;
  /** Переключить состояние */
  toggle(side: SidebarSide): void;
  /** Получить текущее состояние */
  getState(side: SidebarSide): SidebarState;

  /** Установить ширину */
  setWidth(side: SidebarSide, width: number): void;
  /** Получить ширину */
  getWidth(side: SidebarSide): number;

  /** Зарегистрировать таб */
  registerTab(tab: SidebarTab): void;
  /** Удалить таб */
  removeTab(tabId: string): void;
  /** Активировать таб */
  activateTab(tabId: string): void;
  /** Получить активный таб */
  getActiveTab(): string;

  /** Получить DOM элемент слота для монтирования */
  getSlot(slotId: string): HTMLElement | null;
  /** Получить контейнер контента */
  getContentContainer(side: SidebarSide): HTMLElement | null;
}
