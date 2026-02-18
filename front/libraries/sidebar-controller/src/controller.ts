import type { SidebarSide, SidebarState, SidebarTab, SidebarControllerAPI } from "./types";
import {
  $leftSidebarState,
  $rightSidebarState,
  $leftSidebarWidth,
  $rightSidebarWidth,
  $sidebarTabs,
  $activeTab,
  sidebarExpanded,
  sidebarCollapsed,
  sidebarToggled,
  sidebarWidthChanged,
  tabRegistered,
  tabRemoved,
  tabActivated,
  restoreState,
} from "./store";
import { initDOM, destroyDOM, getSlotElement, getContentContainer } from "./dom";
import { initTabs, destroyTabs, setIconRenderer } from "./tabs";

/** Конфигурация по умолчанию */
const DEFAULT_CONFIG = {
  minWidth: 200,
  maxWidth: 600,
};

/** Флаг инициализации */
let initialized = false;

/** Создать контроллер сайдбара */
export const createSidebarController = (config?: {
  minWidth?: number;
  maxWidth?: number;
  iconRenderer?: (iconName: string, container: HTMLElement) => void;
}): SidebarControllerAPI => {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  return {
    init() {
      if (initialized) return;
      initialized = true;

      // Восстановить состояние из storage
      restoreState();

      // Установить рендерер иконок если передан
      if (config?.iconRenderer) {
        setIconRenderer(config.iconRenderer);
      }

      // Инициализировать DOM bindings
      initDOM({ minWidth: cfg.minWidth, maxWidth: cfg.maxWidth });

      // Инициализировать табы
      initTabs();
    },

    destroy() {
      if (!initialized) return;
      initialized = false;

      destroyTabs();
      destroyDOM();
    },

    expand(side: SidebarSide) {
      sidebarExpanded(side);
    },

    collapse(side: SidebarSide) {
      sidebarCollapsed(side);
    },

    toggle(side: SidebarSide) {
      sidebarToggled(side);
    },

    getState(side: SidebarSide): SidebarState {
      return side === "left" ? $leftSidebarState.getState() : $rightSidebarState.getState();
    },

    setWidth(side: SidebarSide, width: number) {
      const clampedWidth = Math.min(cfg.maxWidth, Math.max(cfg.minWidth, width));
      sidebarWidthChanged({ side, width: clampedWidth });
    },

    getWidth(side: SidebarSide): number {
      return side === "left" ? $leftSidebarWidth.getState() : $rightSidebarWidth.getState();
    },

    registerTab(tab: SidebarTab) {
      tabRegistered(tab);
    },

    removeTab(tabId: string) {
      tabRemoved(tabId);
    },

    activateTab(tabId: string) {
      tabActivated(tabId);
    },

    getActiveTab(): string {
      return $activeTab.getState();
    },

    getSlot(slotId: string): HTMLElement | null {
      return getSlotElement(slotId);
    },

    getContentContainer(side: SidebarSide): HTMLElement | null {
      return getContentContainer(side);
    },
  };
};

/** Синглтон для удобства */
export const sidebarController = createSidebarController();
