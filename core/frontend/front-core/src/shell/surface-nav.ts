import { availableSurfaces } from "front-core/object-runtime";
import type { SurfaceTab, WorkspaceSubtab } from "./workspace";

export type SurfaceNavGroup = {
	surface: string;
	label: string;
	purpose: string;
	active: boolean;
	subtabs: WorkspaceSubtab[];
	/** Key of the pressed subtab, or null when the surface shows its own screen. */
	pressed: string | null;
};

/**
 * The two levels as one list: every surface in the strip, each with its own
 * buttons. This is what the mobile menu renders, because on a phone the panel
 * covers the viewport and the tab strip cannot be reached at all.
 *
 * It used to group *pinned* tabs by owner, deriving the group name by stripping
 * `sf-` from an id. Both halves are gone: the surfaces come from configuration,
 * so one that has never been opened is still listed, and each names itself.
 */
export function groupSurfaceNav(
	tabs: readonly SurfaceTab[],
	subtabs: readonly WorkspaceSubtab[],
): SurfaceNavGroup[] {
	return tabs.map((tab) => ({
		surface: tab.id,
		label: tab.label,
		purpose: tab.purpose,
		active: tab.active,
		pressed: tab.pressed,
		subtabs: subtabs.filter((subtab) => subtab.surface === tab.id),
	}));
}

/**
 * The same list plus surfaces that are permitted but not yet open — the menu
 * shown only when the user asks for it.
 *
 * Deliberately not the default: most of what is registered is of no use to a
 * given person, and a wall of sections nobody asked for is the scattering this
 * structure exists to end. `availableSurfaces()` is already filtered by the
 * session's rights, so a guest sees the few public ones rather than everything
 * that happens to be built.
 */
export function allSurfaceNav(
	tabs: readonly SurfaceTab[],
	subtabs: readonly WorkspaceSubtab[],
): SurfaceNavGroup[] {
	const open = new Map(tabs.map((tab) => [tab.id, tab]));
	const rest = availableSurfaces().filter((surface) => !open.has(surface.id));
	return [
		...groupSurfaceNav(tabs, subtabs),
		...rest.map((surface) => ({
			surface: surface.id,
			label: surface.label,
			purpose: surface.purpose,
			active: false,
			pressed: null,
			subtabs: [],
		})),
	];
}
