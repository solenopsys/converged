import { createEvent, createStore } from "effector";
import {
	createDashboardServiceClient,
	type DashboardIndicatorPin,
	type DashboardIndicatorPinInput,
} from "g-dashboard";
import { createElement, type ReactNode } from "react";
import {
	type DashboardWidgetSize,
	getDashboardWidgetSize,
	hasDashboardWidget,
	resolveDashboardWidget,
	subscribeDashboardWidgetRegistry,
} from "./dashboard_widget_registry";
import { $readyLayouts, $slotContents, mount, mountWhenReady } from "./slots";

// Maps a pin's componentKey prefix to the microfrontend module that owns its
// live widget factory. Used to lazily load that module on the State Stream
// page so persisted pins can re-materialize without first opening the source
// dashboard.
const DASHBOARD_WIDGET_MODULES: Record<string, string> = {
	classifier: "mf-classifier",
	companies: "mf-companies",
	dag: "mf-dag",
	dumps: "mf-dumps",
	geo: "mf-geo",
	logs: "mf-logs",
	mailing: "mf-mailing",
	marker: "mf-marker",
	orders: "mf-orders",
	parameters: "mf-parameters",
	places: "mf-places",
	sales: "mf-sales",
	sheduller: "mf-sheduller",
	telemetry: "mf-telemetry",
	usage: "mf-usage",
};

const loadedWidgetModules = new Set<string>();
const inflightWidgetModules = new Map<string, Promise<void>>();

function resolveRuntimeModuleSpecifier(moduleName: string): string {
	if (typeof document === "undefined") return moduleName;

	const script = document.querySelector<HTMLScriptElement>(
		'script[type="importmap"]',
	);
	if (!script?.textContent) return `/mf/${moduleName}.js`;

	try {
		const parsed = JSON.parse(script.textContent) as {
			imports?: Record<string, string>;
		};
		return parsed.imports?.[moduleName] ?? `/mf/${moduleName}.js`;
	} catch {
		return `/mf/${moduleName}.js`;
	}
}

function widgetModuleFor(componentKey: string): string | undefined {
	const prefix = componentKey.split(".")[0];
	return DASHBOARD_WIDGET_MODULES[prefix];
}

// Loads the microfrontend that registers the widget factory for `componentKey`.
// Registration notifies the widget registry, which re-materializes indicators.
async function ensureWidgetModuleLoaded(componentKey: string): Promise<void> {
	if (hasDashboardWidget(componentKey)) return;

	const moduleName = widgetModuleFor(componentKey);
	if (!moduleName || loadedWidgetModules.has(moduleName)) return;

	const inflight = inflightWidgetModules.get(moduleName);
	if (inflight) return inflight;

	const loadPromise = (async () => {
		try {
			await import(
				/* @vite-ignore */ resolveRuntimeModuleSpecifier(moduleName)
			);
			loadedWidgetModules.add(moduleName);
		} catch (error) {
			console.error("[dashboard-slots] Failed to load widget module", {
				componentKey,
				moduleName,
				error,
			});
		} finally {
			inflightWidgetModules.delete(moduleName);
		}
	})();

	inflightWidgetModules.set(moduleName, loadPromise);
	return loadPromise;
}

const DASHBOARD_PIN_EVENT = "front-core:dashboard-pin";
const DASHBOARD_INDICATORS_CHANGED_EVENT =
	"front-core:dashboard-indicators-changed";
const DASHBOARD_RUNTIME_KEY = "__front_core_dashboard_runtime__";

const dashboardClient = createDashboardServiceClient({ baseUrl: "/services" });

export type DashboardIndicator = {
	widgetId: string;
	slotId: string;
	component: ReactNode;
	size: DashboardWidgetSize;
	pin: DashboardIndicatorPin;
};

export type DashboardPinRegistration = Omit<
	DashboardIndicatorPinInput,
	"widgetId"
>;

type RegisteredWidget = {
	component: ReactNode;
	meta?: DashboardPinRegistration;
};

type DashboardPinEventDetail = {
	originId: string;
	widgetId: string;
	component: ReactNode;
	meta?: DashboardPinRegistration;
};

type DashboardRuntimeState = {
	indicatorPins: DashboardIndicatorPin[];
	indicatorItems: DashboardIndicator[];
	registeredWidgets: Map<string, RegisteredWidget>;
	listeners: Set<() => void>;
	loadPromise: Promise<DashboardIndicator[]> | null;
};

type DashboardRuntimeGlobal = typeof globalThis & {
	[DASHBOARD_RUNTIME_KEY]?: DashboardRuntimeState;
};

function getRuntime(): DashboardRuntimeState {
	const runtimeGlobal = globalThis as DashboardRuntimeGlobal;
	runtimeGlobal[DASHBOARD_RUNTIME_KEY] ??= {
		indicatorPins: [],
		indicatorItems: [],
		registeredWidgets: new Map(),
		listeners: new Set(),
		loadPromise: null,
	};
	return runtimeGlobal[DASHBOARD_RUNTIME_KEY];
}

export const dashboardIndicatorMounted = createEvent<DashboardIndicator>();
export const dashboardIndicatorsSynced = createEvent<DashboardIndicator[]>();

export const $dashboardIndicators = createStore<DashboardIndicator[]>([])
	.on(dashboardIndicatorMounted, (items, indicator) => {
		const next = items.filter((item) => item.widgetId !== indicator.widgetId);
		return [...next, indicator];
	})
	.on(dashboardIndicatorsSynced, (_, items) => items);

function createOptimisticPin(
	widgetId: string,
	meta?: DashboardPinRegistration,
): DashboardIndicatorPin {
	const now = new Date().toISOString();
	return {
		id: widgetId,
		widgetId,
		title: meta?.title,
		source: meta?.source,
		componentKey: meta?.componentKey,
		position: meta?.position ?? getRuntime().indicatorPins.length,
		createdAt: now,
		updatedAt: now,
	};
}

function upsertPinSnapshot(pin: DashboardIndicatorPin) {
	const { indicatorPins } = getRuntime();
	const next = indicatorPins.filter((item) => item.widgetId !== pin.widgetId);
	setPinSnapshot([...next, pin]);
}

function pinUpdatedAtMs(pin: DashboardIndicatorPin): number {
	// nrpc revives ISO date strings into Date objects on the wire, while
	// optimistic pins carry plain ISO strings — normalize both before sorting.
	const time = new Date(pin.updatedAt).getTime();
	return Number.isNaN(time) ? 0 : time;
}

function setPinSnapshot(pins: DashboardIndicatorPin[]) {
	getRuntime().indicatorPins = [...pins].sort(
		(a, b) => a.position - b.position || pinUpdatedAtMs(b) - pinUpdatedAtMs(a),
	);
}

function isLegacyGeneratedPin(pin: DashboardIndicatorPin): boolean {
	const widgetId = pin.widgetId.trim();
	const componentKey = pin.componentKey?.trim() ?? widgetId;
	return (
		/^dashboard-_r_[\w-]*(?:\.|_r_)/.test(widgetId) ||
		/^dashboard-_r_[\w-]*(?:\.|_r_)/.test(componentKey) ||
		/\.(?:widget|card)-\d+$/.test(widgetId) ||
		/\.(?:widget|card)-\d+$/.test(componentKey)
	);
}

function emitIndicatorsChanged() {
	const { indicatorItems, listeners } = getRuntime();
	dashboardIndicatorsSynced(indicatorItems);

	for (const listener of listeners) {
		listener();
	}

	if (typeof window === "undefined") return;

	window.dispatchEvent(
		new CustomEvent<DashboardIndicator[]>(DASHBOARD_INDICATORS_CHANGED_EVENT, {
			detail: indicatorItems,
		}),
	);
}

function createPendingIndicator(
	pin: DashboardIndicatorPin,
	loading: boolean,
): ReactNode {
	return createElement(
		"div",
		{
			className:
				"flex min-h-24 flex-col justify-center rounded-md bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground",
		},
		createElement(
			"div",
			{ className: "font-medium text-foreground" },
			pin.title ?? pin.widgetId,
		),
		createElement(
			"div",
			{ className: "mt-1 text-xs leading-5" },
			loading
				? "Loading live widget…"
				: "Live widget unavailable — open its dashboard to render it.",
		),
	);
}

function materializeIndicators(
	resolveSlot: (widgetId: string) => string,
): DashboardIndicator[] {
	const { indicatorPins, registeredWidgets } = getRuntime();
	return indicatorPins.map((pin) => {
		const componentKey = pin.componentKey ?? pin.widgetId;
		// Prefer the standalone live factory (survives reloads); fall back to the
		// component registered by a currently-mounted source view; otherwise show
		// a transient placeholder while the owning microfrontend loads.
		const liveComponent =
			resolveDashboardWidget(componentKey) ??
			registeredWidgets.get(pin.widgetId)?.component ??
			null;

		const slotId = `dashboard:${resolveSlot(pin.widgetId)}`;
		return {
			widgetId: pin.widgetId,
			slotId,
			component:
				liveComponent ??
				createPendingIndicator(pin, Boolean(widgetModuleFor(componentKey))),
			size: getDashboardWidgetSize(componentKey),
			pin,
		};
	});
}

export function syncDashboardIndicators() {
	void dashboardSlots.loadIndicators();
}

export function getDashboardIndicatorsSnapshot(): DashboardIndicator[] {
	return [...getRuntime().indicatorItems];
}

export function subscribeDashboardIndicators(listener: () => void): () => void {
	getRuntime().listeners.add(listener);

	return () => {
		getRuntime().listeners.delete(listener);
	};
}

class DashboardSlots {
	public list: string[] = [];
	private counter = 0;
	private savedWidgets: Map<string, ReactNode> = new Map();
	private widgetSlots: Map<string, string> = new Map();
	private pendingMounts: Map<string, () => void> = new Map();
	private instanceId = `dashboard-slots-${Math.random().toString(36).slice(2)}`;

	constructor() {
		this.installGlobalBridge();
		// Re-materialize whenever a microfrontend registers its widget factories,
		// upgrading pending placeholders to live widgets after a lazy load.
		subscribeDashboardWidgetRegistry(() => {
			this.syncMaterializedIndicators();
		});
	}

	next(prefix: string, widgetId?: string): string {
		if (widgetId && this.widgetSlots.has(widgetId)) {
			const existingSlot = this.widgetSlots.get(widgetId);
			if (existingSlot) {
				return existingSlot;
			}
		}

		const slotId = `${prefix}-${this.counter}`;
		this.counter++;
		this.list.push(slotId);

		if (widgetId) {
			this.widgetSlots.set(widgetId, slotId);
		}

		return slotId;
	}

	isPinned(widgetId: string): boolean {
		return getRuntime().indicatorPins.some(
			(item) => item.widgetId === widgetId,
		);
	}

	register(
		widgetId: string,
		component: ReactNode,
		meta?: DashboardPinRegistration,
	) {
		const normalized = widgetId.trim();
		if (!normalized) return;

		getRuntime().registeredWidgets.set(normalized, { component, meta });
		if (this.isPinned(normalized)) {
			this.syncMaterializedIndicators();
		}
	}

	pin(
		widgetId: string,
		component: ReactNode,
		meta?: DashboardPinRegistration,
	): string {
		const normalized = widgetId.trim();
		if (!normalized) {
			throw new Error("widgetId is required");
		}

		this.register(normalized, component, meta);
		const optimisticPin = createOptimisticPin(normalized, meta);
		upsertPinSnapshot(optimisticPin);
		const slotId = this.pinLocal(normalized, component);
		this.syncMaterializedIndicators();
		this.broadcastPin(normalized, component, meta);
		void this.persistPin(normalized, meta);
		return slotId;
	}

	async loadIndicators(): Promise<DashboardIndicator[]> {
		const runtime = getRuntime();
		if (runtime.loadPromise) {
			return runtime.loadPromise;
		}

		runtime.loadPromise = (async () => {
			try {
				const remotePins = await dashboardClient.listIndicators();
				const legacyPins = remotePins.filter(isLegacyGeneratedPin);
				const loadedPins = remotePins.filter(
					(pin) => !isLegacyGeneratedPin(pin),
				);
				for (const pin of legacyPins) {
					void dashboardClient.unpinIndicator(pin.widgetId).catch((error) => {
						console.warn("[dashboard-slots] Failed to remove legacy pin", {
							widgetId: pin.widgetId,
							error,
						});
					});
				}
				const loadedIds = new Set(loadedPins.map((pin) => pin.widgetId));
				const optimisticPins = getRuntime().indicatorPins.filter(
					(pin) => !loadedIds.has(pin.widgetId) && !isLegacyGeneratedPin(pin),
				);
				setPinSnapshot([...loadedPins, ...optimisticPins]);
			} catch (error) {
				console.warn("[dashboard-slots] Failed to load indicator pins", error);
			}

			this.syncMaterializedIndicators();
			return getDashboardIndicatorsSnapshot();
		})().finally(() => {
			getRuntime().loadPromise = null;
		});

		return runtime.loadPromise;
	}

	async unpin(widgetId: string): Promise<void> {
		const normalized = widgetId.trim();
		if (!normalized) return;

		setPinSnapshot(
			getRuntime().indicatorPins.filter((item) => item.widgetId !== normalized),
		);
		this.syncMaterializedIndicators();

		try {
			await dashboardClient.unpinIndicator(normalized);
			await this.loadIndicators();
		} catch (error) {
			console.warn("[dashboard-slots] Failed to unpin indicator", {
				widgetId: normalized,
				error,
			});
		}
	}

	private async persistPin(
		widgetId: string,
		meta?: DashboardPinRegistration,
	): Promise<void> {
		try {
			const saved = await dashboardClient.pinIndicator({
				widgetId,
				...meta,
			});
			upsertPinSnapshot(saved);
			this.syncMaterializedIndicators();
		} catch (error) {
			console.warn("[dashboard-slots] Failed to save indicator pin", {
				widgetId,
				error,
			});
		}
	}

	private pinLocal(widgetId: string, component: ReactNode): string {
		const slotId = this.next("pinned", widgetId);
		const fullSlotId = `dashboard:${slotId}`;
		this.savedWidgets.set(fullSlotId, component);

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

	private syncMaterializedIndicators() {
		const runtime = getRuntime();
		runtime.indicatorItems = materializeIndicators((widgetId) =>
			this.next("pinned", widgetId),
		);

		for (const indicator of runtime.indicatorItems) {
			this.savedWidgets.set(indicator.slotId, indicator.component);
			dashboardIndicatorMounted(indicator);
		}

		emitIndicatorsChanged();

		// Kick off lazy loading of microfrontends owning any still-unresolved pin.
		for (const pin of runtime.indicatorPins) {
			const componentKey = pin.componentKey ?? pin.widgetId;
			if (
				!hasDashboardWidget(componentKey) &&
				!runtime.registeredWidgets.has(pin.widgetId)
			) {
				void ensureWidgetModuleLoaded(componentKey);
			}
		}
	}

	private installGlobalBridge() {
		if (typeof window === "undefined") return;

		window.addEventListener(DASHBOARD_PIN_EVENT, (event) => {
			const detail = (event as CustomEvent<DashboardPinEventDetail>).detail;
			if (!detail || detail.originId === this.instanceId) return;
			if (!detail.widgetId || !detail.component) return;

			this.register(detail.widgetId, detail.component, detail.meta);
			upsertPinSnapshot(createOptimisticPin(detail.widgetId, detail.meta));
			this.pinLocal(detail.widgetId, detail.component);
			this.syncMaterializedIndicators();
		});
	}

	private broadcastPin(
		widgetId: string,
		component: ReactNode,
		meta?: DashboardPinRegistration,
	) {
		if (typeof window === "undefined") return;

		window.dispatchEvent(
			new CustomEvent<DashboardPinEventDetail>(DASHBOARD_PIN_EVENT, {
				detail: {
					originId: this.instanceId,
					widgetId,
					component,
					meta,
				},
			}),
		);
	}

	saveWidgets() {
		const contents = $slotContents.getState();
		this.savedWidgets.clear();

		Object.entries(contents).forEach(([slotId, component]) => {
			if (slotId.startsWith("dashboard:")) {
				this.savedWidgets.set(slotId, component);
			}
		});
	}

	restoreWidgets() {
		this.savedWidgets.forEach((component, slotId) => {
			mountWhenReady(component, slotId, { layoutName: "dashboard" });
		});
	}

	clear() {
		for (const cancel of this.pendingMounts.values()) {
			cancel();
		}
		this.list = [];
		this.savedWidgets.clear();
		this.widgetSlots.clear();
		this.pendingMounts.clear();
		setPinSnapshot([]);
		getRuntime().indicatorItems = [];
		emitIndicatorsChanged();
		this.counter = 0;
		void dashboardClient.clearIndicators().catch((error) => {
			console.warn("[dashboard-slots] Failed to clear indicator pins", error);
		});
	}
}

export const dashboardSlots = new DashboardSlots();
