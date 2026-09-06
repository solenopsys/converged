export type SidebarSide = "left" | "right";

export type SidebarState = "expanded" | "collapsed";

export type RightPanelTab = "navigation" | "chat" | "events" | "trace";

export type RightPanelEventLevel = "info" | "success" | "warning" | "error";

export type RightPanelEventLink = {
	surface?: string;
	ref?: string;
	href?: string;
};

/**
 * One business notification in the right panel's feed: a letter arrived, an
 * order came in, a job finished. Published by `pushrouter` and addressed at a
 * person, so this is not a place for local UI chatter.
 *
 * Headline and body arrive as translation keys wherever the sender had one —
 * the service that emitted the event does not know the reader's locale.
 * `title`/`body` carry the literals no catalog can hold: a mail subject, an
 * order number, a device name.
 */
export type RightPanelEvent = {
	id: string;
	/** Business event name, e.g. `order.created`. */
	name: string;
	level: RightPanelEventLevel;
	at: number;
	titleKey?: string;
	title?: string;
	bodyKey?: string;
	body?: string;
	params?: Record<string, string | number>;
	link?: RightPanelEventLink;
	read?: boolean;
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
