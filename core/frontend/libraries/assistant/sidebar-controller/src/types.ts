export type SidebarSide = "left" | "right";

export type SidebarState = "expanded" | "collapsed";

export type RightPanelTab = "commands" | "chat" | "events";

export type RightPanelEvent = {
	id: string;
	label: string;
	at: number;
};

export interface SidebarTab {
	id: string;
	title: string;
	iconName?: string;
	order?: number;
}

export interface SidebarConfig {
	side: SidebarSide;
	defaultWidth: number;
	minWidth: number;
	maxWidth: number;
	collapsible: boolean;
}

export interface SidebarSelectors {
	root: string;

	trigger: string;

	resizer: string;

	tabsContainer: string;

	contentContainer: string;

	menuContainer: string;
}

export interface SidebarControllerOptions {
	left?: Partial<SidebarConfig>;
	right?: Partial<SidebarConfig>;
	selectors?: Partial<Record<SidebarSide, Partial<SidebarSelectors>>>;

	persist?: boolean;

	storageKey?: string;
}

export interface SidebarControllerAPI {
	init(): void;

	destroy(): void;

	expand(side: SidebarSide): void;

	collapse(side: SidebarSide): void;

	toggle(side: SidebarSide): void;

	getState(side: SidebarSide): SidebarState;

	setWidth(side: SidebarSide, width: number): void;

	getWidth(side: SidebarSide): number;

	registerTab(tab: SidebarTab): void;

	removeTab(tabId: string): void;

	activateTab(tabId: string): void;

	getActiveTab(): string;

	getSlot(slotId: string): HTMLElement | null;

	getContentContainer(side: SidebarSide): HTMLElement | null;
}
