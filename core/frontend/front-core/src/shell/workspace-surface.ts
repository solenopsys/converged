import { availableSurfaces, registerSurface } from "front-core/object-runtime";
import { setWorkspaceReader } from "../workspace-view";
import { loadSurface } from "./sf";
import { surfaceMenu } from "./surface-menu";
import {
	$activeSurface,
	$pressedSubtab,
	menus,
	subtabActivated,
	subtabReleased,
	surfaceMounted,
	type WorkspaceSubtab,
} from "./workspace";

// The two navigation levels, as callable operations.
//
// This is what makes a step of the orchestrator commit to the interface instead
// of only patching its own context: choosing a surface *is* opening its tab,
// and choosing an item *is* opening it inside. Nothing new is needed in the
// kernel — they are ordinary catalog entries, so a step reaches them through
// the same port it reaches everything else, and the transcript records them
// the way it records any other call.
//
// Hidden: it owns operations but is not a place, so it must not appear in the
// tab strip it operates.

export const MOUNT_SURFACE = "workspace.surface.mount";
export const PRESS_SUBTAB = "workspace.subtab.press";
export const RELEASE_SUBTAB = "workspace.subtab.release";

/** What the surface step chooses from: the strip's catalog menu. */
export function surfaceChoices(): Array<{
	id: string;
	label: string;
	purpose: string;
}> {
	return availableSurfaces().map(({ id, label, purpose }) => ({
		id,
		label,
		purpose,
	}));
}

/**
 * What the item step chooses from, for one surface: its catalog menu and whatever
 * is open in it. Not only what is on screen — a projection nobody has opened
 * yet is exactly what the step may need. Commands are left out: the assistant
 * reaches operations through the catalog, not through a menu row.
 */
export function subtabChoices(
	surface: string,
): Array<{ key: string; title: string; pressed: boolean }> {
	const state = menus.$states.getState()[surface];
	const active = $activeSurface.getState() === surface ? state?.active : null;
	const catalog = surfaceMenu(surface).filter(
		(item) => item.kind !== "command",
	);
	const listed = new Set(catalog.map((item) => item.id));
	const opened = Object.values(state?.entries ?? {}).filter(
		(entry) => !listed.has(entry.id),
	);
	return [
		...catalog.map((item) => ({ key: item.id, title: item.label })),
		...opened.map((entry) => ({ key: entry.id, title: entry.label })),
	].map((choice) => ({ ...choice, pressed: choice.key === active }));
}

export function registerWorkspaceSurface(): void {
	registerSurface({
		id: "workspace",
		label: "Workspace",
		purpose: "Moving between sections and the items inside them",
		hidden: true,
		types: [],
		views: [],
		operations: [
			{
				id: MOUNT_SURFACE,
				operator: "execute",
				label: "Open a section",
				description:
					"Open a section of the application and make it active. It opens on its overview; nothing else inside it is opened.",
				access: "public",
				parameters: {
					type: "object",
					properties: {
						surface: {
							type: "string",
							description: "Exact id of the section, copied from the list",
						},
					},
					required: ["surface"],
				},
				invoke: async ({ params }) => {
					const surface = String(params.surface ?? "");
					const known = availableSurfaces().some(
						(entry) => entry.id === surface,
					);
					// An invented id would open nothing and report success. The step
					// that chose it is told instead, so it can say what it could not do.
					if (!known) {
						throw new Error(
							`[workspace] Unknown section: "${surface}"; available: ${availableSurfaces()
								.map((entry) => entry.id)
								.join(", ")}`,
						);
					}
					surfaceMounted(surface);
					await loadSurface(surface);
					return { ok: true, surface };
				},
			},
			{
				id: PRESS_SUBTAB,
				operator: "execute",
				label: "Open an item in the open section",
				description:
					"Open one of the items of the active section's menu, showing what it holds.",
				access: "public",
				parameters: {
					type: "object",
					properties: {
						key: {
							type: "string",
							description: "Exact key of the item, copied from the list",
						},
					},
					required: ["key"],
				},
				invoke: ({ params }) => {
					const key = String(params.key ?? "");
					const surface = $activeSurface.getState();
					const known =
						surface !== null &&
						subtabChoices(surface).some((choice) => choice.key === key);
					if (!known) {
						throw new Error(`[workspace] Unknown item: "${key}"`);
					}
					subtabActivated(key);
					return { ok: true, key };
				},
			},
			{
				id: RELEASE_SUBTAB,
				operator: "execute",
				label: "Return to the section overview",
				description: "Show the active section's own overview screen.",
				access: "public",
				parameters: { type: "object", properties: {} },
				invoke: () => {
					const surface = $activeSurface.getState();
					if (!surface) return { ok: false, error: "No section is open" };
					subtabReleased(surface);
					return { ok: true, surface };
				},
			},
		],
	});
}

/** Installs the shell as the source of truth for "where is the user". */
export function installWorkspaceReader(): void {
	setWorkspaceReader({
		position: () => {
			const surface = $activeSurface.getState();
			if (!surface) return undefined;
			const pressed = $pressedSubtab.getState() ?? undefined;
			const entry = availableSurfaces().find((item) => item.id === surface);
			const state = stateLine(pressed);
			return {
				surface,
				...(entry ? { surfaceLabel: entry.label } : {}),
				...(pressed ? { subtab: pressed.key, subtabLabel: pressed.title } : {}),
				...(pressed?.ref ? { type: pressed.ref.type } : {}),
				...(state ? { state } : {}),
			};
		},
		subtabs: subtabChoices,
	});
}

/**
 * The pressed subtab's state as one short phrase. Deliberately not JSON: this
 * goes into every step's prompt, and a filter document there is noise the model
 * has to parse before it can read the question.
 */
function stateLine(subtab: WorkspaceSubtab | undefined): string | undefined {
	const ref = subtab?.ref;
	if (ref?.kind !== "set") return undefined;
	if (ref.selection.kind === "ids")
		return `${ref.selection.ids.length} selected`;
	const filter = ref.selection.filter;
	const fields = filter
		? Object.keys(filter).filter(
				(key) => key !== "AND" && key !== "OR" && key !== "NOT",
			)
		: [];
	const presets = ref.selection.presets?.map((preset) => preset.id) ?? [];
	const parts = [...fields, ...presets];
	return parts.length > 0 ? `filtered by ${parts.join(", ")}` : "all";
}
