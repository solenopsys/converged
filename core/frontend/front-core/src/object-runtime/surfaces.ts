import { createDomain } from "effector";
import { onOperationAuthorizationChanged } from "./authorization";
import { localized } from "./catalog";
import { objectRegistry, surfaceDeclared, surfaceRegistered } from "./registry";
import { objectResolver } from "./resolver";
import { OPERATORS } from "./types";

// Which surfaces exist, in what order, and which of them the interface offers.
//
// The surface proposes (label, purpose, its views); the core decides. That
// split is the reason this lives beside the registry rather than inside it: a
// registry entry is a fact about what was built, and this is a decision about
// what to show, which is configuration and belongs to whoever owns the
// workspace — not to the module that happens to implement the screen.
//
// It replaces counting the function catalog (`chat/catalog.ts` used to derive
// the list from `module → count`), which made a surface with no currently
// permitted function invisible to the assistant even though its tab was right
// there on screen.

const domain = createDomain("surface-config");

export type SurfaceConfigEntry = {
	id: string;
	/** Absent from the interface entirely: no tab, and not offered to the model. */
	enabled?: boolean;
	/** Mounted and kept in the tab strip without being opened first. */
	pinned?: boolean;
	/** Ascending; surfaces without one follow, ordered by label. */
	order?: number;
};

/**
 * The workspace's own settings. Configuration is data (`projections.md`), so
 * this is a value the host supplies — from a service, so it survives the
 * session and the machine — not something derived from the bundle.
 */
export type SurfaceConfig = {
	surfaces: readonly SurfaceConfigEntry[];
};

export type SurfaceEntry = {
	id: string;
	label: string;
	/** One line: what it is for. Read by the first orchestrator step. */
	purpose: string;
	pinned: boolean;
	/** False until the module behind it has been imported. */
	loaded: boolean;
};

export const surfaceConfigured =
	domain.createEvent<SurfaceConfig>("CONFIGURED");

/**
 * Empty means "no decision has been made yet", which is not the same as "no
 * surfaces": until a configuration arrives every declared surface is offered.
 * A host that has never configured anything still gets a working interface.
 */
export const $surfaceConfig = domain
	.createStore<SurfaceConfig | null>(null, { name: "SURFACE_CONFIG" })
	.on(surfaceConfigured, (_current, next) => next);

const entryFor = (
	config: SurfaceConfig | null,
	id: string,
): SurfaceConfigEntry | undefined =>
	config?.surfaces.find((entry) => entry.id === id);

const orderOf = (entry: SurfaceConfigEntry | undefined): number =>
	entry?.order ?? Number.MAX_SAFE_INTEGER;

/**
 * Surfaces that own at least one thing the resolver can reach — the same set
 * the assistant's first level was counted from before.
 *
 * Deliberately **not** filtered by the session's rights. `canDiscover` applies
 * only under `discovery: "panel"` (resolver.ts), and the assistant's catalog
 * has always asked without it, because authorization here is a step in the
 * flow, not a filter on it: a guest is shown the section, tries to open it, and
 * `authorizeOperation` is what raises the login prompt. Filter the list by
 * rights instead and a guest is offered nothing, the turn ends in words, and
 * the prompt never appears — there is no way left to sign in.
 *
 * The command panel keeps its own stricter view; that is what the flag is for.
 */
function reachableSurfaces(): Set<string> {
	const owners = new Set<string>();
	for (const operator of OPERATORS) {
		for (const candidate of objectResolver.resolve(operator)) {
			const owner =
				candidate.owner ??
				(candidate.targetType
					? objectRegistry.ownerForType(candidate.targetType)
					: undefined);
			if (owner) owners.add(owner);
		}
	}
	return owners;
}

/**
 * Every surface the interface offers right now: declared, permitted, and not
 * switched off.
 *
 * Reads the registry on every call rather than caching, for the same reason the
 * operator catalog does: surfaces arrive while the page is live, and a snapshot
 * taken at start-up is wrong by the second module.
 */
export function availableSurfaces(): SurfaceEntry[] {
	const config = $surfaceConfig.getState();
	const reachable = reachableSurfaces();
	return objectRegistry
		.allSurfaces()
		.flatMap((surface) => {
			if (surface.hidden) return [];
			const entry = entryFor(config, surface.id);
			if (entry?.enabled === false) return [];
			// A configuration that lists surfaces is a whitelist: something the
			// workspace has never heard of is not silently added to its tab strip.
			if (config && !entry) return [];
			// `enabled: true` is the deliberate override for a surface that has
			// nothing resolvable yet but should still be reachable.
			if (!reachable.has(surface.id) && entry?.enabled !== true) return [];
			return [
				{
					id: surface.id,
					// An index built before these fields existed carries neither, and
					// so does a surface declared without them at runtime. The id is a
					// poor name but a real string: sorting on an undefined label
					// throws, and that takes the whole turn down with it.
					label:
						localized(surface.id, surface.labelKey, surface.label) ??
						surface.label ??
						surface.id,
					purpose:
						localized(surface.id, surface.purposeKey, surface.purpose) ??
						surface.purpose ??
						"",
					pinned: entry?.pinned ?? false,
					loaded: surface.loaded,
					order: orderOf(entry),
				},
			];
		})
		.sort(
			(left, right) =>
				left.order - right.order || left.label.localeCompare(right.label),
		)
		.map(({ order: _order, ...surface }) => surface);
}

export function availableSurface(id: string): SurfaceEntry | undefined {
	return availableSurfaces().find((surface) => surface.id === id);
}

/** Re-read whenever the set of surfaces or their names can have changed. */
export function onSurfacesChanged(listener: () => void): () => void {
	const stop = [
		surfaceDeclared.watch(listener),
		surfaceRegistered.watch(listener),
		$surfaceConfig.watch(() => listener()),
	];
	// Signing in changes which surfaces exist for this session, and that has to
	// reach the strip and the assistant's list the moment it happens.
	const stopAuth = onOperationAuthorizationChanged(listener);
	return () => {
		for (const subscription of stop) subscription.unsubscribe();
		stopAuth();
	};
}
