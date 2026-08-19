// Controller
export { createSidebarController, sidebarController } from "./controller";
// DOM utils
export { getContentContainer, getSlotElement, getTabsContainer } from "./dom";

export {
	$activeTab,
	$leftSidebarState,
	$leftSidebarWidth,
	$menuSectionsState,
	$rightPanelEvents,
	$rightPanelTab,
	$rightSidebarState,
	$rightSidebarWidth,
	$sidebarTabs,
	controllerDestroyed,
	controllerInitialized,
	menuSectionToggled,
	menuStateHydrated,
	persistState,
	restoreState,
	rightPanelEventRecorded,
	rightPanelTabActivated,
	sidebarCollapsed,
	sidebarExpanded,
	sidebarToggled,
	sidebarWidthChanged,
	sidebarWidthReset,
	tabActivated,
	tabRegistered,
	tabRemoved,
	tabsCleared,
} from "./store";
// Tabs
export { setIconRenderer } from "./tabs";
export type {
	RightPanelEvent,
	RightPanelTab,
	SidebarConfig,
	SidebarControllerAPI,
	SidebarControllerOptions,
	SidebarSide,
	SidebarState,
	SidebarTab,
} from "./types";
