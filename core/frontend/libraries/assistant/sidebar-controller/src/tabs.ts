import type { SidebarTab } from "./types";
import { $sidebarTabs, $activeTab, tabActivated } from "./store";
import { getTabsContainer } from "./dom";


const CSS = {
  tab: "sidebar-tab",
  tabActive: "sidebar-tab--active",
  tabIcon: "sidebar-tab__icon",
  tabTitle: "sidebar-tab__title",
} as const;


const tabElements = new Map<string, HTMLElement>();


let iconRenderer: (iconName: string, container: HTMLElement) => void = (iconName, container) => {
  container.textContent = iconName;
};


export const setIconRenderer = (renderer: (iconName: string, container: HTMLElement) => void) => {
  iconRenderer = renderer;
};


const createTabElement = (tab: SidebarTab): HTMLElement => {
  const el = document.createElement("button");
  el.className = CSS.tab;
  el.setAttribute("data-tab-id", tab.id);
  el.type = "button";

  if (tab.iconName) {
    const iconEl = document.createElement("span");
    iconEl.className = CSS.tabIcon;
    iconRenderer(tab.iconName, iconEl);
    el.appendChild(iconEl);
  }

  el.setAttribute("title", tab.title);
  el.setAttribute("aria-label", tab.title);

  el.addEventListener("click", () => {
    tabActivated(tab.id);
  });

  return el;
};


const updateActiveState = (activeId: string) => {
  tabElements.forEach((el, id) => {
    el.classList.toggle(CSS.tabActive, id === activeId);
  });
};


const syncTabs = (tabs: SidebarTab[], container: HTMLElement) => {
  const currentIds = new Set(tabs.map((t) => t.id));

  tabElements.forEach((el, id) => {
    if (!currentIds.has(id)) {
      el.remove();
      tabElements.delete(id);
    }
  });

  tabs.forEach((tab) => {
    if (!tabElements.has(tab.id)) {
      const el = createTabElement(tab);
      tabElements.set(tab.id, el);
      container.appendChild(el);
    }
  });

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

  updateActiveState($activeTab.getState());
};


const listeners: Array<() => void> = [];


export const initTabs = () => {
  const container = getTabsContainer("left");
  if (!container) return;

  const unwatchTabs = $sidebarTabs.watch((tabs) => {
    syncTabs(tabs, container);
  });

  const unwatchActive = $activeTab.watch((activeId) => {
    updateActiveState(activeId);
  });

  listeners.push(unwatchTabs, unwatchActive);

  syncTabs($sidebarTabs.getState(), container);
};


export const destroyTabs = () => {
  listeners.forEach((fn) => fn());
  listeners.length = 0;
  tabElements.forEach((el) => el.remove());
  tabElements.clear();
};
