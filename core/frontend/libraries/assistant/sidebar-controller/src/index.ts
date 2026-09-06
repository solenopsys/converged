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
	$rightPanelUnreadCount,
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
	rightPanelEventsCleared,
	rightPanelEventsHydrated,
	rightPanelEventsRead,
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
	RightPanelEventLevel,
	RightPanelEventLink,
	RightPanelTab,
	SidebarConfig,
	SidebarControllerAPI,
	SidebarControllerOptions,
	SidebarSide,
	SidebarState,
	SidebarTab,
} from "./types";
