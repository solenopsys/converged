// Types
export type {
  SidebarSide,
  SidebarState,
  SidebarTab,
  SidebarConfig,
  SidebarControllerAPI,
  SidebarControllerOptions,
} from "./types";

// Controller
export { createSidebarController, sidebarController } from "./controller";

// Store (events & stores для прямого доступа)
export {
  // Events
  sidebarToggled,
  sidebarExpanded,
  sidebarCollapsed,
  sidebarWidthChanged,
  sidebarWidthReset,
  tabRegistered,
  tabRemoved,
  tabActivated,
  tabsCleared,
  menuSectionToggled,
  menuStateHydrated,
  controllerInitialized,
  controllerDestroyed,
  // Stores
  $leftSidebarState,
  $rightSidebarState,
  $leftSidebarWidth,
  $rightSidebarWidth,
  $sidebarTabs,
  $activeTab,
  $menuSectionsState,
} from "./store";

// DOM utils
export { getSlotElement, getContentContainer, getTabsContainer } from "./dom";

// Tabs
export { setIconRenderer } from "./tabs";
