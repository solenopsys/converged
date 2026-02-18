import type { SidebarSide, SidebarState } from "./types";
import {
  $leftSidebarState,
  $rightSidebarState,
  $leftSidebarWidth,
  $rightSidebarWidth,
  sidebarToggled,
  sidebarWidthChanged,
} from "./store";

/** CSS классы */
const CSS = {
  expanded: "sidebar--expanded",
  collapsed: "sidebar--collapsed",
  resizing: "sidebar--resizing",
} as const;

/** Data-атрибуты для поиска элементов */
const ATTR = {
  sidebar: "data-sidebar",
  trigger: "data-sidebar-trigger",
  resizer: "data-sidebar-resizer",
  slot: "data-sidebar-slot",
  tabsContainer: "data-sidebar-tabs",
  contentContainer: "data-sidebar-content",
} as const;

/** Кэш DOM элементов */
const elements: {
  left: {
    root: HTMLElement | null;
    trigger: HTMLElement | null;
    resizer: HTMLElement | null;
    content: HTMLElement | null;
    tabs: HTMLElement | null;
  };
  right: {
    root: HTMLElement | null;
    trigger: HTMLElement | null;
    resizer: HTMLElement | null;
    content: HTMLElement | null;
    tabs: HTMLElement | null;
  };
} = {
  left: { root: null, trigger: null, resizer: null, content: null, tabs: null },
  right: { root: null, trigger: null, resizer: null, content: null, tabs: null },
};

/** Найти и закэшировать DOM элементы */
export const findElements = () => {
  // Left sidebar
  elements.left.root = document.querySelector(`[${ATTR.sidebar}="left"]`);
  elements.left.trigger = document.querySelector(`[${ATTR.trigger}="left"]`);
  elements.left.resizer = document.querySelector(`[${ATTR.resizer}="left"]`);
  elements.left.content = document.querySelector(`[${ATTR.contentContainer}="left"]`);
  elements.left.tabs = document.querySelector(`[${ATTR.tabsContainer}="left"]`);

  // Right sidebar
  elements.right.root = document.querySelector(`[${ATTR.sidebar}="right"]`);
  elements.right.trigger = document.querySelector(`[${ATTR.trigger}="right"]`);
  elements.right.resizer = document.querySelector(`[${ATTR.resizer}="right"]`);
  elements.right.content = document.querySelector(`[${ATTR.contentContainer}="right"]`);
  elements.right.tabs = document.querySelector(`[${ATTR.tabsContainer}="right"]`);
};

/** Получить элемент слота по ID */
export const getSlotElement = (slotId: string): HTMLElement | null => {
  return document.querySelector(`[${ATTR.slot}="${slotId}"]`);
};

/** Получить контейнер контента */
export const getContentContainer = (side: SidebarSide): HTMLElement | null => {
  return elements[side].content;
};

/** Получить контейнер табов */
export const getTabsContainer = (side: SidebarSide): HTMLElement | null => {
  return elements[side].tabs;
};

/** Применить состояние к DOM */
const applyState = (side: SidebarSide, state: SidebarState) => {
  const root = elements[side].root;
  if (!root) return;

  root.classList.remove(CSS.expanded, CSS.collapsed);
  root.classList.add(state === "expanded" ? CSS.expanded : CSS.collapsed);
  root.setAttribute("data-state", state);
};

/** Применить ширину к DOM */
const applyWidth = (side: SidebarSide, width: number) => {
  const root = elements[side].root;
  if (!root) return;

  root.style.setProperty("--sidebar-width", `${width}px`);
};

/** Обработчики событий */
const listeners: Array<() => void> = [];

/** Подписаться на клик по trigger */
const bindTrigger = (side: SidebarSide) => {
  const trigger = elements[side].trigger;
  if (!trigger) return;

  const handler = (e: Event) => {
    e.preventDefault();
    sidebarToggled(side);
  };

  trigger.addEventListener("click", handler);
  listeners.push(() => trigger.removeEventListener("click", handler));
};

/** Подписаться на drag ресайзера */
const bindResizer = (side: SidebarSide, minWidth: number, maxWidth: number) => {
  const resizer = elements[side].resizer;
  const root = elements[side].root;
  if (!resizer || !root) return;

  let startX = 0;
  let startWidth = 0;
  let isDragging = false;

  const onMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    startWidth = side === "left" ? $leftSidebarWidth.getState() : $rightSidebarWidth.getState();
    root.classList.add(CSS.resizing);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const diff = side === "left" ? e.clientX - startX : startX - e.clientX;
    const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + diff));
    sidebarWidthChanged({ side, width: newWidth });
  };

  const onMouseUp = () => {
    if (!isDragging) return;
    isDragging = false;
    root.classList.remove(CSS.resizing);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  resizer.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);

  listeners.push(() => {
    resizer.removeEventListener("mousedown", onMouseDown);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  });
};

/** Подписаться на изменения store и обновлять DOM */
const bindStoreToDOM = () => {
  const unwatchLeft = $leftSidebarState.watch((state) => applyState("left", state));
  const unwatchRight = $rightSidebarState.watch((state) => applyState("right", state));
  const unwatchLeftWidth = $leftSidebarWidth.watch((width) => applyWidth("left", width));
  const unwatchRightWidth = $rightSidebarWidth.watch((width) => applyWidth("right", width));

  listeners.push(unwatchLeft, unwatchRight, unwatchLeftWidth, unwatchRightWidth);
};

/** Инициализировать DOM bindings */
export const initDOM = (config: { minWidth: number; maxWidth: number }) => {
  findElements();
  bindTrigger("left");
  bindTrigger("right");
  bindResizer("left", config.minWidth, config.maxWidth);
  bindResizer("right", config.minWidth, config.maxWidth);
  bindStoreToDOM();

  // Применить начальное состояние
  applyState("left", $leftSidebarState.getState());
  applyState("right", $rightSidebarState.getState());
  applyWidth("left", $leftSidebarWidth.getState());
  applyWidth("right", $rightSidebarWidth.getState());
};

/** Очистить все listeners */
export const destroyDOM = () => {
  listeners.forEach((fn) => fn());
  listeners.length = 0;
};
