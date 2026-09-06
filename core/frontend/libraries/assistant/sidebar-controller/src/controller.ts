import {
	destroyDOM,
	getContentContainer,
	getSlotElement,
	initDOM,
} from "./dom";
import {
	$activeTab,
	$leftSidebarState,
	$leftSidebarWidth,
	$rightSidebarState,
	$rightSidebarWidth,
	$sidebarTabs,
	restoreState,
	sidebarCollapsed,
	sidebarExpanded,
	sidebarToggled,
	sidebarWidthChanged,
	tabActivated,
	tabRegistered,
	tabRemoved,
} from "./store";
import { destroyTabs, initTabs, setIconRenderer } from "./tabs";
import type {
	SidebarControllerAPI,
	SidebarSide,
	SidebarState,
	SidebarTab,
} from "./types";

const DEFAULT_CONFIG = {
	minWidth: 200,
	maxWidth: 600,
};

let initialized = false;

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

			restoreState();

			if (config?.iconRenderer) {
				setIconRenderer(config.iconRenderer);
			}

			initDOM({ minWidth: cfg.minWidth, maxWidth: cfg.maxWidth });

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
			return side === "left"
				? $leftSidebarState.getState()
				: $rightSidebarState.getState();
		},

		setWidth(side: SidebarSide, width: number) {
			const clampedWidth = Math.min(
				cfg.maxWidth,
				Math.max(cfg.minWidth, width),
			);
			sidebarWidthChanged({ side, width: clampedWidth });
		},

		getWidth(side: SidebarSide): number {
			return side === "left"
				? $leftSidebarWidth.getState()
				: $rightSidebarWidth.getState();
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

export const sidebarController = createSidebarController();
