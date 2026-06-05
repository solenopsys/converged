import type { ReactNode } from "react";

// Registry of *live* dashboard widget factories, keyed by the pin's
// componentKey (e.g. "dag.stat.failed", "logs.errors").
//
// A persisted dashboard pin only stores ids — it cannot store the React
// component. Microfrontends register a factory per pinnable widget at load
// time so that a pinned indicator can be re-materialized as the real, live
// component after a reload, instead of a dead placeholder.

export type DashboardWidgetFactory = () => ReactNode;

// Bento sizing hint for the indicators grid. "lg" widgets (charts) span a 2x2
// tile; everything else occupies a single cell.
export type DashboardWidgetSize = "sm" | "lg";

export type DashboardWidgetDefinition = {
	render: DashboardWidgetFactory;
	size?: DashboardWidgetSize;
};

// A registration is either a bare factory (default "sm") or a full definition.
export type DashboardWidgetEntry =
	| DashboardWidgetFactory
	| DashboardWidgetDefinition;

const REGISTRY_KEY = "__front_core_dashboard_widget_registry__";

type DashboardWidgetRegistryState = {
	factories: Map<string, DashboardWidgetDefinition>;
	listeners: Set<() => void>;
};

type DashboardWidgetRegistryGlobal = typeof globalThis & {
	[REGISTRY_KEY]?: DashboardWidgetRegistryState;
};

function getRegistry(): DashboardWidgetRegistryState {
	const runtimeGlobal = globalThis as DashboardWidgetRegistryGlobal;
	runtimeGlobal[REGISTRY_KEY] ??= {
		factories: new Map(),
		listeners: new Set(),
	};
	return runtimeGlobal[REGISTRY_KEY];
}

function notify() {
	for (const listener of getRegistry().listeners) {
		listener();
	}
}

function normalizeEntry(
	entry: DashboardWidgetEntry,
): DashboardWidgetDefinition {
	return typeof entry === "function" ? { render: entry } : entry;
}

export function registerDashboardWidget(
	componentKey: string,
	entry: DashboardWidgetEntry,
): void {
	const key = componentKey.trim();
	if (!key) return;
	getRegistry().factories.set(key, normalizeEntry(entry));
	notify();
}

export function registerDashboardWidgets(
	entries: Record<string, DashboardWidgetEntry>,
): void {
	const { factories } = getRegistry();
	let changed = false;
	for (const [componentKey, entry] of Object.entries(entries)) {
		const key = componentKey.trim();
		if (!key) continue;
		factories.set(key, normalizeEntry(entry));
		changed = true;
	}
	if (changed) notify();
}

export function hasDashboardWidget(componentKey: string): boolean {
	return getRegistry().factories.has(componentKey.trim());
}

export function resolveDashboardWidget(componentKey: string): ReactNode | null {
	const definition = getRegistry().factories.get(componentKey.trim());
	return definition ? definition.render() : null;
}

export function getDashboardWidgetSize(
	componentKey: string,
): DashboardWidgetSize {
	return getRegistry().factories.get(componentKey.trim())?.size ?? "sm";
}

export function subscribeDashboardWidgetRegistry(
	listener: () => void,
): () => void {
	getRegistry().listeners.add(listener);
	return () => {
		getRegistry().listeners.delete(listener);
	};
}
