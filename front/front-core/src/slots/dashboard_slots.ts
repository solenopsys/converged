import { createEvent, createStore } from "effector";
import type { ReactNode } from "react";
import { $readyLayouts, $slotContents, mount, mountWhenReady } from "./slots";

const DASHBOARD_PIN_EVENT = "front-core:dashboard-pin";
const DASHBOARD_INDICATORS_CHANGED_EVENT =
	"front-core:dashboard-indicators-changed";
const DASHBOARD_INDICATORS_STORE_KEY = "__front_core_dashboard_indicators__";

export type DashboardIndicator = {
	widgetId: string;
	slotId: string;
	component: ReactNode;
};

type DashboardIndicatorsStore = {
	items: DashboardIndicator[];
	listeners: Set<(items: DashboardIndicator[]) => void>;
};

type DashboardPinEventDetail = {
	originId: string;
	widgetId: string;
	component: ReactNode;
};

type RuntimeWindow = Window & {
	[DASHBOARD_INDICATORS_STORE_KEY]?: DashboardIndicatorsStore;
};

function getGlobalIndicatorsStore(): DashboardIndicatorsStore | null {
	if (typeof window === "undefined") return null;

	const runtimeWindow = window as RuntimeWindow;
	runtimeWindow[DASHBOARD_INDICATORS_STORE_KEY] ??= {
		items: [],
		listeners: new Set(),
	};
	return runtimeWindow[DASHBOARD_INDICATORS_STORE_KEY];
}

function readGlobalIndicators(): DashboardIndicator[] {
	return getGlobalIndicatorsStore()?.items ?? [];
}

function emitGlobalIndicatorsChanged(store: DashboardIndicatorsStore) {
	if (typeof window === "undefined") return;

	window.dispatchEvent(
		new CustomEvent<DashboardIndicator[]>(DASHBOARD_INDICATORS_CHANGED_EVENT, {
			detail: store.items,
		}),
	);
}

function notifyGlobalIndicators(store: DashboardIndicatorsStore) {
	for (const listener of store.listeners) {
		listener(store.items);
	}
	emitGlobalIndicatorsChanged(store);
}

function upsertGlobalIndicator(indicator: DashboardIndicator) {
	const store = getGlobalIndicatorsStore();
	if (!store) {
		dashboardIndicatorMounted(indicator);
		return;
	}

	const next = store.items.filter(
		(item) => item.widgetId !== indicator.widgetId,
	);
	store.items = [...next, indicator];
	notifyGlobalIndicators(store);
}

function clearGlobalIndicators() {
	const store = getGlobalIndicatorsStore();
	if (!store) {
		dashboardIndicatorsSynced([]);
		return;
	}

	store.items = [];
	notifyGlobalIndicators(store);
}

export const dashboardIndicatorMounted = createEvent<DashboardIndicator>();
export const dashboardIndicatorsSynced = createEvent<DashboardIndicator[]>();

export const $dashboardIndicators = createStore<DashboardIndicator[]>(
	readGlobalIndicators(),
)
	.on(dashboardIndicatorMounted, (items, indicator) => {
		const next = items.filter((item) => item.widgetId !== indicator.widgetId);
		return [...next, indicator];
	})
	.on(dashboardIndicatorsSynced, (_, items) => items);

export function syncDashboardIndicators() {
	dashboardIndicatorsSynced(readGlobalIndicators());
}

export function getDashboardIndicatorsSnapshot(): DashboardIndicator[] {
	return [...readGlobalIndicators()];
}

export function subscribeDashboardIndicators(listener: () => void): () => void {
	if (typeof window === "undefined") return () => {};

	const handleChange = () => listener();
	window.addEventListener(DASHBOARD_INDICATORS_CHANGED_EVENT, handleChange);
	return () => {
		window.removeEventListener(
			DASHBOARD_INDICATORS_CHANGED_EVENT,
			handleChange,
		);
	};
}

function installIndicatorsStoreSync() {
	const store = getGlobalIndicatorsStore();
	if (!store) return;

	store.listeners.add(dashboardIndicatorsSynced);
	dashboardIndicatorsSynced(store.items);
}

installIndicatorsStoreSync();

class DashboardSlots {
	public list: string[] = [];
	private counter = 0;
	private savedWidgets: Map<string, ReactNode> = new Map();
	private widgetSlots: Map<string, string> = new Map(); // widgetId -> slotId
	private pendingMounts: Map<string, () => void> = new Map();
	private instanceId = `dashboard-slots-${Math.random().toString(36).slice(2)}`;

	constructor() {
		this.installGlobalBridge();
	}

	next(prefix: string, widgetId?: string): string {
		// Если widgetId указан и уже есть слот для него - возвращаем существующий
		if (widgetId && this.widgetSlots.has(widgetId)) {
			const existingSlot = this.widgetSlots.get(widgetId);
			if (existingSlot) {
				return existingSlot;
			}
		}

		// Создаем новый слот
		const slotId = `${prefix}-${this.counter}`;
		this.counter++;
		this.list.push(slotId);

		// Сохраняем связь widgetId -> slotId
		if (widgetId) {
			this.widgetSlots.set(widgetId, slotId);
		}

		return slotId;
	}

	isPinned(widgetId: string): boolean {
		return (
			this.widgetSlots.has(widgetId) ||
			readGlobalIndicators().some((item) => item.widgetId === widgetId)
		);
	}

	pin(widgetId: string, component: ReactNode): string {
		const slotId = this.pinLocal(widgetId, component);
		this.broadcastPin(widgetId, component);
		return slotId;
	}

	private pinLocal(widgetId: string, component: ReactNode): string {
		const slotId = this.next("pinned", widgetId);
		const fullSlotId = `dashboard:${slotId}`;
		this.savedWidgets.set(fullSlotId, component);
		upsertGlobalIndicator({ widgetId, slotId: fullSlotId, component });

		if ($readyLayouts.getState().has("dashboard")) {
			mount(component, fullSlotId);
			return slotId;
		}

		this.pendingMounts.get(fullSlotId)?.();
		const cancel = mountWhenReady(component, fullSlotId, {
			layoutName: "dashboard",
		});
		this.pendingMounts.set(fullSlotId, cancel);
		return slotId;
	}

	private installGlobalBridge() {
		if (typeof window === "undefined") return;

		window.addEventListener(DASHBOARD_PIN_EVENT, (event) => {
			const detail = (event as CustomEvent<DashboardPinEventDetail>).detail;
			if (!detail || detail.originId === this.instanceId) return;
			if (!detail.widgetId || !detail.component) return;

			this.pinLocal(detail.widgetId, detail.component);
		});
	}

	private broadcastPin(widgetId: string, component: ReactNode) {
		if (typeof window === "undefined") return;

		window.dispatchEvent(
			new CustomEvent<DashboardPinEventDetail>(DASHBOARD_PIN_EVENT, {
				detail: {
					originId: this.instanceId,
					widgetId,
					component,
				},
			}),
		);
	}

	// Сохраняем виджеты перед уходом с dashboard
	saveWidgets() {
		const contents = $slotContents.getState();
		this.savedWidgets.clear();

		Object.entries(contents).forEach(([slotId, component]) => {
			if (slotId.startsWith("dashboard:")) {
				this.savedWidgets.set(slotId, component);
			}
		});
	}

	// Восстанавливаем виджеты при возврате
	restoreWidgets() {
		this.savedWidgets.forEach((component, slotId) => {
			mountWhenReady(component, slotId, { layoutName: "dashboard" });
		});
	}

	// Очищаем всё (опционально)
	clear() {
		for (const cancel of this.pendingMounts.values()) {
			cancel();
		}
		this.list = [];
		this.savedWidgets.clear();
		this.widgetSlots.clear();
		this.pendingMounts.clear();
		clearGlobalIndicators();
		this.counter = 0;
	}
}

export const dashboardSlots = new DashboardSlots();
