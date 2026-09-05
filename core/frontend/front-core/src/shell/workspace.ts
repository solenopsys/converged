import { combine, createEvent, createStore, sample } from "effector";
import { bus } from "front-core/core";
import type {
	DomainRef,
	PresentationSource,
	SurfaceEntry,
} from "front-core/object-runtime";
import {
	$surfaceConfig,
	availableSurfaces,
	objectRegistry,
	onOperationAuthorizationChanged,
	setRef,
	surfaceDeclared,
	surfaceRegistered,
} from "front-core/object-runtime";
import type { ComponentType } from "preact";
import {
	$composerPlacement,
	panelOpened,
	surfacePresenceChanged,
} from "./panel";

// The workspace has two levels, and they answer different questions.
//
// A **surface** is a tab: a place in the interface that gathers functionality
// by meaning. Which ones exist is configuration (`object-runtime/surfaces.ts`),
// not a consequence of what has been opened.
//
// A **subtab** is a button inside one: a view of that surface, or something the
// user opened — a row, an object, a selection. Usually none is pressed, and the
// surface shows its own screen; pressing one is navigation inside the tab, not
// a new tab.
//
// This used to be one flat level. Every presented reference became a top-level
// tab, so a surface owning seven types and fifteen views (sf-sales) scattered
// itself across the strip and the interface read as unrelated screens. The
// owner was recorded on every tab all along, which is what makes the second
// level derivable rather than something surfaces have to declare twice.

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
	/** Deferred so an inactive projection does not start loading its data. */
	prepareProps?: () => Record<string, unknown>;
	/**
	 * Declared by the surface and always present, as opposed to opened by
	 * someone and closable. Only dynamic subtabs are subject to the cap below.
	 */
	permanent: boolean;
};

export type OpenSubtab = Omit<WorkspaceSubtab, "permanent"> & {
	permanent?: boolean;
	/** Who opened it; kept for callers that log or branch on provenance. */
	source?: PresentationSource;
};

/**
 * Dynamic subtabs of one surface beyond which the oldest is dropped. Opened
 * things accumulate — every row a user clicks is one — and a button bar that
 * grows without limit is the scattering this structure exists to end.
 */
const DYNAMIC_CAPACITY = 8;

type WorkspaceState = {
	subtabs: WorkspaceSubtab[];
	/** Surfaces present in the tab strip, in the order they were mounted. */
	mounted: string[];
	activeSurface: string | null;
	/**
	 * Per surface, the pressed subtab. A surface present here with `null` — or
	 * absent entirely — has none pressed, which is the normal state.
	 */
	pressed: Record<string, string | null>;
	/** Runtime pin overrides on top of the configured ones. */
	pins: Record<string, boolean>;
};

const initialState: WorkspaceState = {
	subtabs: [],
	mounted: [],
	activeSurface: null,
	pressed: {},
	pins: {},
};

export const surfaceMounted = createEvent<string>("SURFACE_MOUNTED");
export const surfaceActivated = createEvent<string>("SURFACE_ACTIVATED");
export const surfaceClosed = createEvent<string>("SURFACE_CLOSED");
export const surfacePinToggled = createEvent<string>("SURFACE_PIN_TOGGLED");

export const subtabOpened = createEvent<OpenSubtab>("SUBTAB_OPENED");
export const subtabActivated = createEvent<string>("SUBTAB_ACTIVATED");
export const subtabClosed = createEvent<string>("SUBTAB_CLOSED");
/** Press none: the surface falls back to its own screen. */
export const subtabReleased = createEvent<string>("SUBTAB_RELEASED");
export const workspaceReset = createEvent("WORKSPACE_RESET");

/** A stable identity for a view a surface exposes before anything is opened. */
export const projectionKey = (viewId: string): string => `projection:${viewId}`;

const mount = (state: WorkspaceState, surface: string): string[] =>
	state.mounted.includes(surface) ? state.mounted : [...state.mounted, surface];

/** Keeps the newest dynamic subtabs of one surface, permanent ones untouched. */
function capped(
	subtabs: WorkspaceSubtab[],
	surface: string,
): WorkspaceSubtab[] {
	const dynamic = subtabs.filter(
		(subtab) => subtab.surface === surface && !subtab.permanent,
	);
	if (dynamic.length <= DYNAMIC_CAPACITY) return subtabs;
	const dropped = new Set(
		dynamic.slice(0, dynamic.length - DYNAMIC_CAPACITY).map(({ key }) => key),
	);
	return subtabs.filter((subtab) => !dropped.has(subtab.key));
}

/**
 * A set view is a surface capability: it is available before the user opens
 * a record or applies a filter. Object views remain dynamic by definition.
 */
function projectionsOf(surface: string): WorkspaceSubtab[] {
	return objectRegistry
		.allViews()
		.filter(
			(view) =>
				view.owner === surface &&
				view.loaded &&
				view.accepts.kind === "set" &&
				Boolean(view.accepts.type && view.component),
		)
		.map((view) => {
			const typeId = view.accepts.type as string;
			const type = objectRegistry.type(typeId);
			const ref = setRef(typeId, { kind: "query" });
			const props = { reference: ref, bus };
			return {
				key: projectionKey(view.id),
				surface,
				title: view.label ?? type?.pluralLabel ?? type?.label ?? view.id,
				view: view.component as ComponentType<Record<string, unknown>>,
				props,
				...(view.props
					? { prepareProps: () => ({ ...props, ...view.props?.(ref) }) }
					: {}),
				ref,
				viewId: view.id,
				permanent: true,
			};
		});
}

/** Replaces only declared projections, retaining any record or filtered tabs. */
function registerProjections(
	state: WorkspaceState,
	surface: string,
): WorkspaceState {
	const projections = projectionsOf(surface);
	if (projections.length === 0) return state;
	const keys = new Set(projections.map((projection) => projection.key));
	return {
		...state,
		subtabs: [
			...projections,
			...state.subtabs.filter((subtab) => !keys.has(subtab.key)),
		],
	};
}

function activateSubtab(
	state: WorkspaceState,
	subtab: WorkspaceSubtab,
): WorkspaceState {
	const activated = subtab.prepareProps
		? { ...subtab, props: subtab.prepareProps(), prepareProps: undefined }
		: subtab;
	return {
		...state,
		subtabs:
			activated === subtab
				? state.subtabs
				: state.subtabs.map((entry) =>
						entry.key === subtab.key ? activated : entry,
					),
		mounted: mount(state, subtab.surface),
		activeSurface: subtab.surface,
		pressed: { ...state.pressed, [subtab.surface]: subtab.key },
	};
}

export const $workspace = createStore<WorkspaceState>(initialState, {
	name: "WORKSPACE",
})
	.on(surfaceMounted, (state, surface) =>
		registerProjections(
			{ ...state, mounted: mount(state, surface), activeSurface: surface },
			surface,
		),
	)
	.on(surfaceRegistered, (state, definition) =>
		state.mounted.includes(definition.id)
			? registerProjections(state, definition.id)
			: state,
	)
	.on(surfaceActivated, (state, surface) =>
		state.mounted.includes(surface)
			? { ...state, activeSurface: surface }
			: state,
	)
	.on(subtabOpened, (state, { source: _source, ...subtab }) => {
		const next: WorkspaceSubtab = {
			...subtab,
			permanent: subtab.permanent ?? false,
		};
		const index = state.subtabs.findIndex((entry) => entry.key === next.key);
		const subtabs =
			index === -1
				? [...state.subtabs, next]
				: state.subtabs.map((entry, position) =>
						position === index ? next : entry,
					);
		return {
			...state,
			subtabs: capped(subtabs, next.surface),
			mounted: mount(state, next.surface),
			activeSurface: next.surface,
			pressed: { ...state.pressed, [next.surface]: next.key },
		};
	})
	.on(subtabActivated, (state, key) => {
		const subtab = state.subtabs.find((entry) => entry.key === key);
		if (!subtab) return state;
		return activateSubtab(state, subtab);
	})
	.on(subtabReleased, (state, surface) => ({
		...state,
		pressed: { ...state.pressed, [surface]: null },
	}))
	.on(subtabClosed, (state, key) => {
		const subtab = state.subtabs.find((entry) => entry.key === key);
		if (!subtab || subtab.permanent) return state;
		// Closing a button releases the bar rather than pressing a neighbour: the
		// surface's own screen is the resting state, not whatever was next to it.
		return {
			...state,
			subtabs: state.subtabs.filter((entry) => entry.key !== key),
			pressed:
				state.pressed[subtab.surface] === key
					? { ...state.pressed, [subtab.surface]: null }
					: state.pressed,
		};
	})
	.on(surfaceClosed, (state, surface) => {
		const mounted = state.mounted.filter((id) => id !== surface);
		const { [surface]: _pressed, ...pressed } = state.pressed;
		return {
			...state,
			subtabs: state.subtabs.filter((entry) => entry.surface !== surface),
			mounted,
			pressed,
			activeSurface:
				state.activeSurface === surface
					? (mounted.at(-1) ?? null)
					: state.activeSurface,
		};
	})
	.on(surfacePinToggled, (state, surface) => ({
		...state,
		pins: { ...state.pins, [surface]: !isPinned(state, surface) },
	}))
	.reset(workspaceReset);

/** Configured pin, overridden by whatever the user did this session. */
function isPinned(state: WorkspaceState, surface: string): boolean {
	const override = state.pins[surface];
	if (override !== undefined) return override;
	return (
		availableSurfaces().find((entry) => entry.id === surface)?.pinned ?? false
	);
}

export type SurfaceTab = {
	id: string;
	label: string;
	purpose: string;
	active: boolean;
	pinned: boolean;
	/** The pressed subtab, or null when the surface shows its own screen. */
	pressed: string | null;
};

// `availableSurfaces()` reads the registry directly, so nothing about it is an
// effector dependency. Without this the strip would be computed once and never
// again: a surface declared after start-up, or a configuration arriving from
// the service, would change the answer and not the screen.
const surfaceRightsChanged = createEvent("SURFACE_RIGHTS_CHANGED");
onOperationAuthorizationChanged(() => surfaceRightsChanged());

const $surfaceRevision = createStore(0, { name: "SURFACE_REVISION" })
	.on(surfaceDeclared, (revision) => revision + 1)
	.on(surfaceRegistered, (revision) => revision + 1)
	.on($surfaceConfig, (revision) => revision + 1)
	// Signing in adds surfaces; signing out removes them.
	.on(surfaceRightsChanged, (revision) => revision + 1);

/**
 * The tab strip: pinned surfaces, plus whatever has actually been mounted.
 *
 * Being offered and being open are different questions, and only the first one
 * is filtered. A surface that is mounted is on screen — something was presented
 * into it — so dropping it here because it is not currently offered would make
 * the screen unreachable while it is still open. That includes the legacy
 * presenter's `legacy` owner and anything a type declares an owner for without
 * a surface manifest.
 */
export const $surfaceTabs = combine(
	$workspace,
	$surfaceRevision,
	(state): SurfaceTab[] => {
		const offered = new Map<string, SurfaceEntry>(
			availableSurfaces().map((surface) => [surface.id, surface]),
		);
		const ids = [
			...new Set([
				...[...offered.values()]
					.filter((surface) => isPinned(state, surface.id))
					.map(({ id }) => id),
				...state.mounted,
			]),
		];
		return ids.map((id) => {
			const surface = offered.get(id);
			const declared = objectRegistry.surface(id);
			return {
				id,
				label: surface?.label ?? declared?.label ?? id,
				purpose: surface?.purpose ?? declared?.purpose ?? "",
				active: state.activeSurface === id,
				pinned: isPinned(state, id),
				pressed: state.pressed[id] ?? null,
			};
		});
	},
);

export const $activeSurface = $workspace.map((state) => state.activeSurface);

/** Every subtab of one surface, in the order they were opened. */
export const subtabsOf = (
	state: WorkspaceState,
	surface: string | null,
): WorkspaceSubtab[] =>
	surface ? state.subtabs.filter((entry) => entry.surface === surface) : [];

export const $activeSubtabs = $workspace.map((state) =>
	subtabsOf(state, state.activeSurface),
);

/** What the stage renders: the pressed subtab, or nothing when none is. */
export const $pressedSubtab = $workspace.map((state) => {
	if (!state.activeSurface) return null;
	const key = state.pressed[state.activeSurface];
	return state.subtabs.find((entry) => entry.key === key) ?? null;
});

export const $workspaceSubtabs = $workspace.map((state) => state.subtabs);
export const $workspaceMounted = $workspace.map(
	(state) => state.activeSurface !== null,
);

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
