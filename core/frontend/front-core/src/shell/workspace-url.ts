import {
	objectRef,
	objectRegistry,
	presentReference,
	setRef,
	type DomainRef,
} from "front-core/object-runtime";
import {
	$workspace,
	surfaceMounted,
	type WorkspaceSubtab,
	workspaceReset,
} from "./workspace";
import { loadSurface } from "./sf";

export const CONSOLE_PATH = "/console/";
const LEGACY_CONSOLE_PATH = "/console";

type ConsoleRoute = {
	surface?: string;
	viewId?: string;
	ref?: DomainRef;
};

let installed = false;
let restoring = false;

/** Every descendant is handled by the same console SPA. */
export function isConsolePath(pathname: string): boolean {
	return pathname === LEGACY_CONSOLE_PATH || pathname.startsWith(CONSOLE_PATH);
}

function slug(value: string): string {
	return value
		.trim()
		.toLocaleLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function surfaceSegment(surface: string): string {
	return surface.replace(/^sf-/, "");
}

function viewSegment(viewId: string): string | undefined {
	const view = objectRegistry.view(viewId);
	if (!view || view.accepts.kind !== "set" || !view.accepts.type) return undefined;
	const type = objectRegistry.type(view.accepts.type);
	return slug(view.label ?? type?.pluralLabel ?? type?.label ?? view.id);
}

function parseObject(value: string | null): Record<string, unknown> | null {
	if (!value) return {};
	try {
		const parsed = JSON.parse(value);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

function routeFromUrl(href: string): ConsoleRoute | null {
	const url = new URL(href, "http://localhost");
	if (!isConsolePath(url.pathname)) return null;
	const tail = url.pathname.slice(LEGACY_CONSOLE_PATH.length).replace(/^\/+/, "");
	const [surfacePath, projectionPath, objectId] = tail
		? tail.split("/").map(decodeURIComponent)
		: [];
	if (!surfacePath) return {};

	const surface = objectRegistry
		.allSurfaces()
		.find((entry) => surfaceSegment(entry.id) === surfacePath)?.id;
	if (!surface) return null;
	if (!projectionPath) return { surface };

	const view = objectRegistry
		.allViews()
		.find(
			(entry) =>
				entry.owner === surface &&
				entry.accepts.kind === "set" &&
				viewSegment(entry.id) === projectionPath,
		);
	if (!view?.accepts.type) return null;
	if (objectId) {
		return {
			surface,
			viewId: view.id,
			ref: objectRef(view.accepts.type, objectId),
		};
	}

	const filter = parseObject(url.searchParams.get("filter"));
	if (filter === null) return null;
	return {
		surface,
		viewId: view.id,
		ref: setRef(view.accepts.type, { kind: "query", filter }),
	};
}

function projectionFor(subtab: WorkspaceSubtab) {
	const direct = subtab.viewId ? objectRegistry.view(subtab.viewId) : undefined;
	if (direct?.accepts.kind === "set") return direct;
	if (!subtab.ref || subtab.ref.kind !== "object") return undefined;
	return objectRegistry
		.allViews()
		.filter(
			(view) =>
				view.owner === subtab.surface &&
				view.accepts.kind === "set" &&
				view.accepts.type === subtab.ref?.type,
		)
		.sort(
			(left, right) =>
				(right.priority ?? 0) - (left.priority ?? 0) ||
				left.id.localeCompare(right.id),
		)[0];
}

function urlForRoute(
	href: string,
	surface: string | null,
	projection: ReturnType<typeof projectionFor> | undefined,
	ref: DomainRef | undefined,
): string {
	const url = new URL(href, "http://localhost");
	url.search = "";
	url.pathname = CONSOLE_PATH;
	if (!surface) return `${url.pathname}${url.search}${url.hash}`;
	url.pathname = `${CONSOLE_PATH}${encodeURIComponent(surfaceSegment(surface))}`;
	const projectionPath = projection ? viewSegment(projection.id) : undefined;
	if (!projectionPath) return `${url.pathname}${url.search}${url.hash}`;
	url.pathname += `/${encodeURIComponent(projectionPath)}`;
	if (ref?.kind === "object") {
		url.pathname += `/${encodeURIComponent(ref.id)}`;
		return `${url.pathname}${url.search}${url.hash}`;
	}

	const selection = ref?.kind === "set" ? ref.selection : undefined;
	if (selection?.kind === "query") {
		url.searchParams.set("filter", JSON.stringify(selection.filter ?? {}));
	}
	return `${url.pathname}${url.search}${url.hash}`;
}

function urlForWorkspace(
	href: string,
	surface: string | null,
	subtab: WorkspaceSubtab | null,
): string {
	return urlForRoute(
		href,
		surface,
		subtab ? projectionFor(subtab) : undefined,
		subtab?.ref,
	);
}

/** Compatibility helper for callers that only hold a domain reference. */
export function urlForReference(href: string, ref: DomainRef | null): string {
	if (!ref) return urlForRoute(href, null, undefined, undefined);
	const type = objectRegistry.type(ref.type);
	const view = objectRegistry
		.allViews()
		.filter(
			(entry) =>
				entry.owner === type?.owner &&
				entry.accepts.kind === "set" &&
				entry.accepts.type === ref.type,
		)
		.sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))[0];
	return urlForRoute(href, type?.owner ?? null, view, ref);
}

/** Compatibility helper: the route now resolves a ref from surface/view paths. */
export function referenceFromUrl(href: string): DomainRef | null {
	return routeFromUrl(href)?.ref ?? null;
}

async function restoreFromLocation(): Promise<void> {
	const route = routeFromUrl(window.location.href);
	if (!route) return;

	restoring = true;
	try {
		workspaceReset();
		if (!route.surface) return;
		await loadSurface(route.surface);
		surfaceMounted(route.surface);
		if (route.ref) {
			await presentReference(
				route.ref,
				route.ref.kind === "set" ? { viewId: route.viewId } : {},
			);
		}
	} catch (error) {
		console.error(`[shell] Failed to restore ${window.location.pathname}`, error);
	} finally {
		restoring = false;
	}
}

/** Keeps the complete surface/projection/object position addressable below `/console/`. */
export function bootstrapWorkspaceUrl(): void {
	if (installed || typeof window === "undefined") return;
	installed = true;

	$workspace.updates.watch((state) => {
		if (restoring) return;
		const surface = state.activeSurface;
		const key = surface ? state.pressed[surface] : null;
		const subtab = state.subtabs.find((entry) => entry.key === key) ?? null;
		const next = urlForWorkspace(window.location.href, surface, subtab);
		const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
		if (current !== next)
			window.history.pushState(window.history.state, "", next);
	});
	window.addEventListener("popstate", () => {
		void restoreFromLocation();
	});
	void restoreFromLocation();
}
