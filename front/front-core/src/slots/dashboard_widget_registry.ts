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

export type DashboardWidgetResolver = (
	componentKey: string,
) => DashboardWidgetDefinition | DashboardWidgetFactory | null | undefined;

// A registration is either a bare factory (default "sm") or a full definition.
export type DashboardWidgetEntry =
	| DashboardWidgetFactory
	| DashboardWidgetDefinition;

const REGISTRY_KEY = "__front_core_dashboard_widget_registry__";

type DashboardWidgetRegistryState = {
	factories: Map<string, DashboardWidgetDefinition>;
	resolvers: Map<string, DashboardWidgetResolver>;
	listeners: Set<() => void>;
};

type DashboardWidgetRegistryGlobal = typeof globalThis & {
	[REGISTRY_KEY]?: DashboardWidgetRegistryState;
};

function getRegistry(): DashboardWidgetRegistryState {
	const runtimeGlobal = globalThis as DashboardWidgetRegistryGlobal;
	runtimeGlobal[REGISTRY_KEY] ??= {
		factories: new Map(),
		resolvers: new Map(),
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

export function registerDashboardWidgetResolver(
	prefix: string,
	resolver: DashboardWidgetResolver,
): void {
	const normalized = prefix.trim();
	if (!normalized) return;
	getRegistry().resolvers.set(normalized, resolver);
	notify();
}

function resolveDashboardWidgetDefinition(
	componentKey: string,
): DashboardWidgetDefinition | null {
	const key = componentKey.trim();
	const exact = getRegistry().factories.get(key);
	if (exact) return exact;

	const resolvers = [...getRegistry().resolvers.entries()].sort(
		([left], [right]) => right.length - left.length,
	);
	for (const [prefix, resolver] of resolvers) {
		if (!key.startsWith(prefix)) continue;
		const resolved = resolver(key);
		if (resolved) return normalizeEntry(resolved);
	}

	return null;
}

export function hasDashboardWidget(componentKey: string): boolean {
	return Boolean(resolveDashboardWidgetDefinition(componentKey));
}

export function resolveDashboardWidget(componentKey: string): ReactNode | null {
	const definition = resolveDashboardWidgetDefinition(componentKey);
	return definition ? definition.render() : null;
}

export function getDashboardWidgetSize(
	componentKey: string,
): DashboardWidgetSize {
	return resolveDashboardWidgetDefinition(componentKey)?.size ?? "sm";
}

export function subscribeDashboardWidgetRegistry(
	listener: () => void,
): () => void {
	getRegistry().listeners.add(listener);
	return () => {
		getRegistry().listeners.delete(listener);
	};
}
