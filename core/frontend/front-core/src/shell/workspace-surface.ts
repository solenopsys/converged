import {
	availableSurfaces,
	registerSurface,
} from "front-core/object-runtime";
import { setWorkspaceReader } from "../workspace-view";
import {
	$workspace,
	subtabActivated,
	subtabReleased,
	subtabsOf,
	surfaceMounted,
	type WorkspaceSubtab,
} from "./workspace";
import { loadSurface } from "./sf";

// The two navigation levels, as callable operations.
//
// This is what makes a step of the orchestrator commit to the interface instead
// of only patching its own context: choosing a surface *is* mounting the tab,
// and choosing a button *is* pressing it. Nothing new is needed in the kernel —
// they are ordinary catalog entries, so a step reaches them through the same
// port it reaches everything else, and the transcript records them the way it
// records any other call.
//
// Hidden: it owns operations but is not a place, so it must not appear in the
// tab strip it operates.

export const MOUNT_SURFACE = "workspace.surface.mount";
export const PRESS_SUBTAB = "workspace.subtab.press";
export const RELEASE_SUBTAB = "workspace.subtab.release";

/** What the surface step chooses from; the same list the strip shows. */
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

/** What the button step chooses from, for one surface. */
export function subtabChoices(
	surface: string,
): Array<{ key: string; title: string; pressed: boolean }> {
	const state = $workspace.getState();
	const pressed = state.pressed[surface] ?? null;
	return subtabsOf(state, surface).map((subtab) => ({
		key: subtab.key,
		title: subtab.title,
		pressed: subtab.key === pressed,
	}));
}

export function registerWorkspaceSurface(): void {
	registerSurface({
		id: "workspace",
		label: "Workspace",
		purpose: "Moving between tabs and the buttons inside them",
		hidden: true,
		types: [],
		views: [],
		operations: [
			{
				id: MOUNT_SURFACE,
				operator: "execute",
				label: "Open a section",
				description:
					"Mount a section of the application as a tab and make it active. Does not open anything inside it.",
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
					// An invented id would mount nothing and report success. The step
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
				label: "Press a button in the open section",
				description:
					"Press one of the buttons of the active section, showing what it holds.",
				access: "public",
				parameters: {
					type: "object",
					properties: {
						key: {
							type: "string",
							description: "Exact key of the button, copied from the list",
						},
					},
					required: ["key"],
				},
				invoke: ({ params }) => {
					const key = String(params.key ?? "");
					const known = $workspace
						.getState()
						.subtabs.some((subtab) => subtab.key === key);
					if (!known) {
						throw new Error(`[workspace] Unknown button: "${key}"`);
					}
					subtabActivated(key);
					return { ok: true, key };
				},
			},
			{
				id: RELEASE_SUBTAB,
				operator: "execute",
				label: "Return to the section itself",
				description:
					"Release every button of the active section, showing the section's own screen.",
				access: "public",
				parameters: { type: "object", properties: {} },
				invoke: () => {
					const surface = $workspace.getState().activeSurface;
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
			const state = $workspace.getState();
			const surface = state.activeSurface;
			if (!surface) return undefined;
			const pressedKey = state.pressed[surface] ?? null;
			const pressed = state.subtabs.find((subtab) => subtab.key === pressedKey);
			const entry = availableSurfaces().find((item) => item.id === surface);
			return {
				surface,
				...(entry ? { surfaceLabel: entry.label } : {}),
				...(pressed ? { subtab: pressed.key, subtabLabel: pressed.title } : {}),
				...(pressed?.ref ? { type: pressed.ref.type } : {}),
				...(stateLine(pressed) ? { state: stateLine(pressed) } : {}),
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
