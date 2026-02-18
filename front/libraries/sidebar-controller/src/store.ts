import { createDomain, sample } from "effector";
import type { SidebarSide, SidebarState, SidebarTab } from "./types";

const domain = createDomain("sidebar-controller");

// ============ EVENTS ============

/** Переключение состояния сайдбара */
export const sidebarToggled = domain.createEvent<SidebarSide>();
export const sidebarExpanded = domain.createEvent<SidebarSide>();
export const sidebarCollapsed = domain.createEvent<SidebarSide>();

/** Изменение ширины */
export const sidebarWidthChanged = domain.createEvent<{ side: SidebarSide; width: number }>();
export const sidebarWidthReset = domain.createEvent<SidebarSide>();

/** Табы */
export const tabRegistered = domain.createEvent<SidebarTab>();
export const tabRemoved = domain.createEvent<string>();
export const tabActivated = domain.createEvent<string>();
export const tabsCleared = domain.createEvent();

/** Состояние меню (развернутые секции) */
export const menuSectionToggled = domain.createEvent<{ id: string; open: boolean }>();
export const menuStateHydrated = domain.createEvent<Record<string, boolean>>();

/** Инициализация */
export const controllerInitialized = domain.createEvent();
export const controllerDestroyed = domain.createEvent();

// ============ STORES ============

/** Состояние левого сайдбара */
export const $leftSidebarState = domain.createStore<SidebarState>("expanded")
  .on(sidebarExpanded, (state, side) => side === "left" ? "expanded" : state)
  .on(sidebarCollapsed, (state, side) => side === "left" ? "collapsed" : state);

/** Состояние правого сайдбара */
export const $rightSidebarState = domain.createStore<SidebarState>("collapsed")
  .on(sidebarExpanded, (state, side) => side === "right" ? "expanded" : state)
  .on(sidebarCollapsed, (state, side) => side === "right" ? "collapsed" : state);

/** Toggle логика */
sample({
  clock: sidebarToggled,
  source: { left: $leftSidebarState, right: $rightSidebarState },
  fn: (states, side) => {
    const current = side === "left" ? states.left : states.right;
    return { side, newState: current === "expanded" ? "collapsed" : "expanded" };
  },
  target: domain.createEvent<{ side: SidebarSide; newState: SidebarState }>(),
}).watch(({ side, newState }) => {
  if (newState === "expanded") {
    sidebarExpanded(side);
  } else {
    sidebarCollapsed(side);
  }
});

/** Ширина панелей */
export const $leftSidebarWidth = domain.createStore<number>(320)
  .on(sidebarWidthChanged, (state, { side, width }) => side === "left" ? width : state)
  .reset(sidebarWidthReset.filter({ fn: (side) => side === "left" }));

export const $rightSidebarWidth = domain.createStore<number>(320)
  .on(sidebarWidthChanged, (state, { side, width }) => side === "right" ? width : state)
  .reset(sidebarWidthReset.filter({ fn: (side) => side === "right" }));

/** Табы */
export const $sidebarTabs = domain.createStore<SidebarTab[]>([])
  .on(tabRegistered, (tabs, tab) => {
    const filtered = tabs.filter(t => t.id !== tab.id);
    const next = [...filtered, tab];
    return next.sort((a, b) => {
      const orderDiff = (a.order ?? 0) - (b.order ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return a.title.localeCompare(b.title);
    });
  })
  .on(tabRemoved, (tabs, id) => tabs.filter(t => t.id !== id))
  .reset(tabsCleared);

/** Активный таб */
export const $activeTab = domain.createStore<string>("menu")
  .on(tabActivated, (_, id) => id)
  .on(tabRemoved, (active, id) => active === id ? "menu" : active)
  .reset(tabsCleared);

/** Состояние секций меню (развернуто/свернуто) */
export const $menuSectionsState = domain.createStore<Record<string, boolean>>({})
  .on(menuStateHydrated, (_, state) => state)
  .on(menuSectionToggled, (state, { id, open }) => ({ ...state, [id]: open }));

// ============ PERSISTENCE ============

const STORAGE_KEY = "sidebar_controller_state";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const readCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

const writeCookie = (name: string, value: string) => {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}`;
};

/** Сохранение состояния в cookie */
export const persistState = () => {
  if (typeof window === "undefined") return;

  const state = {
    leftState: $leftSidebarState.getState(),
    rightState: $rightSidebarState.getState(),
    leftWidth: $leftSidebarWidth.getState(),
    rightWidth: $rightSidebarWidth.getState(),
    menuSections: $menuSectionsState.getState(),
  };

  try {
    writeCookie(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
};

/** Восстановление состояния из cookie */
export const restoreState = () => {
  if (typeof window === "undefined") return;

  try {
    const raw = readCookie(STORAGE_KEY);
    if (!raw) return;

    const state = JSON.parse(raw);

    if (state.leftState === "expanded") sidebarExpanded("left");
    if (state.leftState === "collapsed") sidebarCollapsed("left");
    if (state.rightState === "expanded") sidebarExpanded("right");
    if (state.rightState === "collapsed") sidebarCollapsed("right");

    if (typeof state.leftWidth === "number") {
      sidebarWidthChanged({ side: "left", width: state.leftWidth });
    }
    if (typeof state.rightWidth === "number") {
      sidebarWidthChanged({ side: "right", width: state.rightWidth });
    }
    if (state.menuSections) {
      menuStateHydrated(state.menuSections);
    }
  } catch {
    // ignore
  }
};

// Автосохранение при изменениях
$leftSidebarState.watch(persistState);
$rightSidebarState.watch(persistState);
$leftSidebarWidth.watch(persistState);
$rightSidebarWidth.watch(persistState);
$menuSectionsState.watch(persistState);
