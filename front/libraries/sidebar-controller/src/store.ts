import { createDomain, sample } from "effector";
import type { SidebarSide, SidebarState, SidebarTab } from "./types";

const domain = createDomain("sidebar-controller");

// ============ EVENTS ============

/** Переключение состояния сайдбара */
export const sidebarToggled = domain.createEvent<SidebarSide>();
export const sidebarExpanded = domain.createEvent<SidebarSide>();
export const sidebarCollapsed = domain.createEvent<SidebarSide>();

/** Изменение ширины */
export const sidebarWidthChanged = domain.createEvent<{
	side: SidebarSide;
	width: number;
}>();
export const sidebarWidthReset = domain.createEvent<SidebarSide>();

/** Табы */
export const tabRegistered = domain.createEvent<SidebarTab>();
export const tabRemoved = domain.createEvent<string>();
export const tabActivated = domain.createEvent<string>();
export const tabsCleared = domain.createEvent();

/** Состояние меню (развернутые секции) */
export const menuSectionToggled = domain.createEvent<{
	id: string;
	open: boolean;
}>();
export const menuStateHydrated = domain.createEvent<Record<string, boolean>>();

/** Инициализация */
export const controllerInitialized = domain.createEvent();
export const controllerDestroyed = domain.createEvent();

// ============ STORES ============

/** Состояние левого сайдбара */
export const $leftSidebarState = domain
	.createStore<SidebarState>("expanded")
	.on(sidebarExpanded, (state, side) => (side === "left" ? "expanded" : state))
	.on(sidebarCollapsed, (state, side) =>
		side === "left" ? "collapsed" : state,
	);

/** Состояние правого сайдбара */
export const $rightSidebarState = domain
	.createStore<SidebarState>("collapsed")
	.on(sidebarExpanded, (state, side) => (side === "right" ? "expanded" : state))
	.on(sidebarCollapsed, (state, side) =>
		side === "right" ? "collapsed" : state,
	);

/** Toggle логика */
sample({
	clock: sidebarToggled,
	source: { left: $leftSidebarState, right: $rightSidebarState },
	fn: (states, side) => {
		const current = side === "left" ? states.left : states.right;
		return {
			side,
			newState: current === "expanded" ? "collapsed" : "expanded",
		};
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
export const $leftSidebarWidth = domain
	.createStore<number>(380)
	.on(sidebarWidthChanged, (state, { side, width }) =>
		side === "left" ? width : state,
	)
	.reset(sidebarWidthReset.filter({ fn: (side) => side === "left" }));

export const $rightSidebarWidth = domain
	.createStore<number>(320)
	.on(sidebarWidthChanged, (state, { side, width }) =>
		side === "right" ? width : state,
	)
	.reset(sidebarWidthReset.filter({ fn: (side) => side === "right" }));

/** Табы */
export const $sidebarTabs = domain
	.createStore<SidebarTab[]>([])
	.on(tabRegistered, (tabs, tab) => {
		const filtered = tabs.filter((t) => t.id !== tab.id);
		const next = [...filtered, tab];
		return next.sort((a, b) => {
			const orderDiff = (a.order ?? 0) - (b.order ?? 0);
			if (orderDiff !== 0) return orderDiff;
			return a.title.localeCompare(b.title);
		});
	})
	.on(tabRemoved, (tabs, id) => tabs.filter((t) => t.id !== id))
	.reset(tabsCleared);

/** Активный таб */
export const $activeTab = domain
	.createStore<string>("menu")
	.on(tabActivated, (_, id) => id)
	.on(tabRemoved, (active, id) => (active === id ? "menu" : active))
	.reset(tabsCleared);

/** Состояние секций меню (развернуто/свернуто) */
export const $menuSectionsState = domain
	.createStore<Record<string, boolean>>({})
	.on(menuStateHydrated, (_, state) => state)
	.on(menuSectionToggled, (state, { id, open }) => ({ ...state, [id]: open }));

// ============ PERSISTENCE ============

const STORAGE_KEY = "sidebar_controller_state";
const LEGACY_RAIL_WIDTH_STORAGE_KEY = "ssr_rail_width";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
let stateRestored = false;

const readCookie = (name: string): string | null => {
	if (typeof document === "undefined") return null;
	const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
	return match ? decodeURIComponent(match[1]) : null;
};

const writeCookie = (name: string, value: string) => {
	if (typeof document === "undefined") return;
	document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}`;
};

const readLocalStorage = (key: string): string | null => {
	if (typeof window === "undefined") return null;
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
};

const writeLocalStorage = (key: string, value: string) => {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(key, value);
	} catch {
		// ignore
	}
};

const readStoredState = (): unknown | null => {
	const localState = readLocalStorage(STORAGE_KEY);
	if (localState) {
		try {
			return JSON.parse(localState);
		} catch {
			// fallback to cookie
		}
	}

	const cookieState = readCookie(STORAGE_KEY);
	if (cookieState) {
		try {
			return JSON.parse(cookieState);
		} catch {
			// ignore
		}
	}

	const legacyRailWidth = readLocalStorage(LEGACY_RAIL_WIDTH_STORAGE_KEY);
	if (legacyRailWidth) {
		const parsed = Number.parseFloat(legacyRailWidth);
		if (Number.isFinite(parsed)) {
			return { leftWidth: parsed, rightWidth: parsed };
		}
	}

	return null;
};

/** Сохранение состояния в browser storage */
export const persistState = () => {
	if (typeof window === "undefined" || !stateRestored) return;

	const state = {
		leftState: $leftSidebarState.getState(),
		rightState: $rightSidebarState.getState(),
		leftWidth: $leftSidebarWidth.getState(),
		rightWidth: $rightSidebarWidth.getState(),
		menuSections: $menuSectionsState.getState(),
	};

	try {
		const serialized = JSON.stringify(state);
		writeLocalStorage(STORAGE_KEY, serialized);
		writeCookie(STORAGE_KEY, serialized);
	} catch {
		// ignore
	}
};

/** Восстановление состояния из browser storage */
export const restoreState = () => {
	if (typeof window === "undefined") {
		stateRestored = true;
		return;
	}

	try {
		const state = readStoredState() as {
			leftState?: SidebarState;
			rightState?: SidebarState;
			leftWidth?: number;
			rightWidth?: number;
			menuSections?: Record<string, boolean>;
		} | null;
		if (!state) return;

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
	} finally {
		stateRestored = true;
		persistState();
	}
};

// Автосохранение при изменениях
$leftSidebarState.watch(persistState);
$rightSidebarState.watch(persistState);
$leftSidebarWidth.watch(persistState);
$rightSidebarWidth.watch(persistState);
$menuSectionsState.watch(persistState);
