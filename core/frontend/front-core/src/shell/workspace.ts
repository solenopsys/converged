import {
	combine,
	createEffect,
	createEvent,
	createStore,
	sample,
} from "effector";
import { bus } from "front-core/core";
import {
	$availableSurfaces,
	$objectRegistryRevision,
	type DomainRef,
	objectRegistry,
	type PresentationSource,
	setRef,
	surfaceRegistered,
} from "front-core/object-runtime";
import type { ComponentType } from "preact";
import { $activeLocale, $localeCatalogRevision } from "../i18n";
import {
	type CatalogItem,
	type Catalogs,
	createScopedTabSet,
	createTabSet,
	type TabEntry,
	type TabSetState,
	type TabView,
} from "../tabs";
import {
	$composerPlacement,
	panelOpened,
	surfacePresenceChanged,
} from "./panel";
import { runCandidate } from "./run-candidate";
import {
	defaultMenuItem,
	OVERVIEW,
	operationIdOf,
	projectionLabel,
	surfaceMenu,
	viewIdOf,
} from "./surface-menu";

// The workspace is two tabbed places, both following the one rule in `tabs/`:
// what the user pinned, plus a single transient tab, plus a catalog menu with the
// rest.
//
// A **surface** is a tab of the top strip: a place that gathers functionality
// by meaning. The catalog is every surface this session is offered, and it
// follows the registry, so a solution installed from the chat shows up in the
// catalog menu the moment it is declared.
//
// Inside the active surface, a **subtab** is one of its projections, a record
// or selection someone opened, or a command. The surface opens on one of them —
// its declared default, else its overview — and nothing else appears until
// the user opens or pins it. A surface pushed out of the strip is forgotten:
// what was open in it goes, what was pinned in it stays.

export { OVERVIEW, projectionKey } from "./surface-menu";

/** What a subtab renders. Kept apart from the tab itself, which is only a label. */
export type WorkspaceSubtab = {
	key: string;
	/** Id of the surface that owns it — the tab this button lives under. */
	surface: string;
	/** Serializable domain identity used to restore the subtab after a reload. */
	ref?: DomainRef;
	viewId?: string;
	title: string;
	view: ComponentType<Record<string, unknown>>;
	props: Record<string, unknown>;
};

export type OpenSubtab = WorkspaceSubtab & {
	icon?: string;
	/** Who opened it; kept for callers that log or branch on provenance. */
	source?: PresentationSource;
};

export type SurfaceTab = TabView;

export const surfaceMounted = createEvent<string>("SURFACE_MOUNTED");
export const surfaceClosed = createEvent<string>("SURFACE_CLOSED");
export const surfacePinToggled = createEvent<string>("SURFACE_PIN_TOGGLED");

export const subtabOpened = createEvent<OpenSubtab>("SUBTAB_OPENED");
export const subtabActivated = createEvent<string>("SUBTAB_ACTIVATED");
export const subtabClosed = createEvent<string>("SUBTAB_CLOSED");
/** Back to the surface's overview. */
export const subtabReleased = createEvent<string>("SUBTAB_RELEASED");
/** Navigation home: nothing open anywhere, pins kept. */
export const workspaceReset = createEvent("WORKSPACE_RESET");

// --- the top strip ----------------------------------------------------------

const $surfaceCatalog = $availableSurfaces.map((list): CatalogItem[] =>
	list.map((surface) => ({
		id: surface.id,
		label: surface.label,
		...(surface.purpose ? { description: surface.purpose } : {}),
		...(surface.pinned ? { pinned: true } : {}),
	})),
);

export const surfaces = createTabSet({
	name: "WORKSPACE_SURFACES",
	$catalog: $surfaceCatalog,
});

/**
 * A surface opened without being offered — the legacy presenter's `legacy`
 * owner, a type whose owner has no manifest — still needs a name on its tab.
 */
const surfaceEntry = (surface: string): TabEntry => ({
	id: surface,
	label: objectRegistry.surface(surface)?.label ?? surface,
});

sample({ clock: surfaceMounted, fn: surfaceEntry, target: surfaces.openEntry });
sample({ clock: surfacePinToggled, target: surfaces.pinToggled });
sample({ clock: surfaceClosed, target: surfaces.closed });

export const $activeSurface = surfaces.$active;
export const $surfaceTabs = surfaces.$tabs;
export const $workspaceMounted = $activeSurface.map(
	(surface) => surface !== null,
);

// --- the bar inside a surface ----------------------------------------------

/**
 * Menus only for the surfaces on screen. Deriving one reads the whole registry,
 * and the strip holds a handful of surfaces while the registry holds all of
 * them.
 */
const $menuCatalogs = combine(
	surfaces.$tabs,
	$objectRegistryRevision,
	$availableSurfaces,
	$activeLocale,
	$localeCatalogRevision,
	(tabs): Catalogs =>
		Object.fromEntries(tabs.map((tab) => [tab.id, surfaceMenu(tab.id)])),
);

export const menus = createScopedTabSet({
	name: "WORKSPACE_MENUS",
	$catalogs: $menuCatalogs,
	$scope: surfaces.$active,
	home: OVERVIEW,
});

// A surface becoming active — from the strip, the catalog menu, the assistant, a
// restored URL — opens on its default item unless something in it is open.
sample({
	clock: surfaces.$active.updates,
	source: menus.$states,
	filter: (states, surface): surface is string =>
		surface !== null && !states[surface]?.active,
	fn: (_, surface) => ({
		scope: surface as string,
		id: defaultMenuItem(surface as string),
	}),
	target: menus.open,
});

sample({ clock: surfaces.evicted, target: menus.scopesForgotten });
sample({ clock: workspaceReset, target: [surfaces.reset, menus.reset] });

// --- what the subtabs render ------------------------------------------------

type Contents = Readonly<
	Record<string, Readonly<Record<string, WorkspaceSubtab>>>
>;

const contentStored = createEvent<WorkspaceSubtab>("SUBTAB_CONTENT_STORED");
const contentsDropped = createEvent<(surface: string, key: string) => boolean>(
	"SUBTAB_CONTENTS_DROPPED",
);

const pinnedIn = (state: TabSetState | undefined, key: string): boolean =>
	state?.pins[key] === true;

export const $contents = createStore<Contents>(
	{},
	{ name: "WORKSPACE_CONTENTS" },
)
	.on(contentStored, (contents, subtab) => ({
		...contents,
		[subtab.surface]: { ...contents[subtab.surface], [subtab.key]: subtab },
	}))
	.on(contentsDropped, (contents, dropped) => {
		let changed = false;
		const next: Record<string, Record<string, WorkspaceSubtab>> = {};
		for (const [surface, subtabs] of Object.entries(contents)) {
			const kept = Object.fromEntries(
				Object.entries(subtabs).filter(([key]) => !dropped(surface, key)),
			);
			const size = Object.keys(kept).length;
			if (size !== Object.keys(subtabs).length) changed = true;
			if (size > 0) next[surface] = kept;
		}
		return changed ? next : contents;
	});

// Content goes with its tab. Eviction is reported explicitly rather than
// inferred from the state, because a surface opening on its default item and
// a record being opened into it arrive in the same tick, in either order.
sample({
	clock: menus.evicted,
	fn:
		({ scope, ids }) =>
		(surface: string, key: string) =>
			surface === scope && ids.includes(key),
	target: contentsDropped,
});
// A forgotten surface keeps what is pinned in it, and nothing else.
sample({
	clock: surfaces.evicted,
	source: menus.$states,
	fn: (states, ids) => (surface: string, key: string) =>
		ids.includes(surface) && !pinnedIn(states[surface], key),
	target: contentsDropped,
});
sample({
	clock: workspaceReset,
	source: menus.$states,
	fn: (states) => (surface: string, key: string) =>
		!pinnedIn(states[surface], key),
	target: contentsDropped,
});

const $position = combine({
	surface: surfaces.$active,
	key: menus.current.$active,
});

/**
 * A projection's content is built when it is opened, not when it is listed:
 * listing costs nothing, and opening is when it may start loading data.
 */
function projectionContent(
	surface: string,
	key: string,
): WorkspaceSubtab | undefined {
	const viewId = viewIdOf(key);
	const view = viewId ? objectRegistry.view(viewId) : undefined;
	if (!view?.component || view.accepts.kind !== "set" || !view.accepts.type)
		return undefined;
	const ref = setRef(view.accepts.type, { kind: "query" });
	return {
		key,
		surface,
		title: projectionLabel(view),
		view: view.component as ComponentType<Record<string, unknown>>,
		props: { reference: ref, bus, ...(view.props?.(ref) ?? {}) },
		ref,
		viewId: view.id,
	};
}

const materialized = sample({
	// Registration is a clock too: a projection opened before its module
	// arrived has no component yet, and gets one here.
	clock: [$position.updates, surfaceRegistered],
	source: { position: $position, contents: $contents },
	fn: ({ position: { surface, key }, contents }) =>
		surface && key && !contents[surface]?.[key]
			? projectionContent(surface, key)
			: undefined,
});
sample({
	clock: materialized.filterMap((content) => content),
	target: contentStored,
});

export const $activeSubtabs = menus.current.$tabs;

/** What the stage renders: the active subtab's content, or null for the overview. */
export const $pressedSubtab = combine(
	$position,
	$contents,
	({ surface, key }, contents) =>
		surface && key ? (contents[surface]?.[key] ?? null) : null,
);

// --- opening, activating, closing subtabs ------------------------------------

sample({
	clock: subtabOpened,
	fn: ({ source: _source, icon: _icon, ...subtab }) => subtab,
	target: contentStored,
});
sample({
	clock: subtabOpened,
	fn: ({ surface }) => surfaceEntry(surface),
	target: surfaces.openEntry,
});
sample({
	clock: subtabOpened,
	fn: ({ surface, key, title, icon }) => ({
		scope: surface,
		id: key,
		entry: { id: key, label: title, ...(icon ? { icon } : {}) },
	}),
	target: menus.open,
});

/**
 * Keys are unique per surface, and callers hand over only the key. The active
 * surface is asked first, then whichever surface holds it, then the owner of
 * the projection it names.
 */
function surfaceOfKey(
	key: string,
	active: string | null,
	states: Readonly<Record<string, TabSetState>>,
	catalogs: Catalogs,
	contents: Contents,
): string | null {
	const holds = (surface: string) =>
		Boolean(
			contents[surface]?.[key] ||
				catalogs[surface]?.some((item) => item.id === key) ||
				states[surface]?.transient === key ||
				pinnedIn(states[surface], key),
		);
	if (active && holds(active)) return active;
	const holder = [
		...new Set([...Object.keys(contents), ...Object.keys(states)]),
	].find(holds);
	if (holder) return holder;
	const viewId = viewIdOf(key);
	return (viewId && objectRegistry.ownerForView(viewId)) || active;
}

const $locator = combine({
	active: surfaces.$active,
	states: menus.$states,
	catalogs: $menuCatalogs,
	contents: $contents,
});

const located = (clock: typeof subtabActivated) =>
	sample({
		clock,
		source: $locator,
		fn: ({ active, states, catalogs, contents }, id) => ({
			scope: surfaceOfKey(id, active, states, catalogs, contents),
			id,
		}),
	}).filterMap(({ scope, id }) => (scope ? { scope, id } : undefined));

const activatedSubtab = located(subtabActivated);
sample({ clock: activatedSubtab, target: menus.open });
sample({
	clock: activatedSubtab,
	fn: ({ scope }) => surfaceEntry(scope),
	target: surfaces.openEntry,
});

sample({ clock: located(subtabClosed), target: menus.close });

sample({
	clock: subtabReleased,
	fn: (surface) => ({ scope: surface, id: OVERVIEW }),
	target: menus.open,
});

// --- commands ----------------------------------------------------------------

/**
 * A command in a menu is an operation. It runs the way a click on a resolved
 * candidate does: a composing operation opens its screen — which lands as the
 * transient tab — and anything else simply executes.
 */
export const runCommandFx = createEffect(async (operationId: string) => {
	const operation = objectRegistry.operation(operationId);
	if (!operation)
		throw new Error(`[workspace] Unknown command: ${operationId}`);
	return runCandidate(operation.operator, {
		id: operation.id,
		kind: "operation",
		operator: operation.operator,
		...(operation.target ? { targetType: operation.target } : {}),
		label: operation.label,
		owner: operation.owner,
		score: 0,
		operation,
	});
});

sample({
	clock: menus.commandChosen.filterMap(({ id }) => operationIdOf(id)),
	target: runCommandFx,
});

runCommandFx.failData.watch((error) =>
	console.error("[workspace] Command failed", error),
);

// --- the rest of the shell ---------------------------------------------------

sample({
	clock: $workspaceMounted,
	target: surfacePresenceChanged,
});

sample({
	clock: $workspaceMounted,
	source: $composerPlacement,
	filter: (placement, mounted) => mounted && placement === "hero",
	target: panelOpened,
});
