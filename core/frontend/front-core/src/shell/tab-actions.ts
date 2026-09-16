import { createEffect, createEvent, createStore, sample } from "effector";
import {
	type ActionItem,
	CLOSE_ACTION,
	PIN_ACTION,
	type TabActionsOf,
} from "../tabs";
import {
	$surfaceTabs,
	type SurfaceTab,
	surfaceClosed,
	surfacePinToggled,
} from "./workspace";

// Right-click actions on a surface tab. Pin and close belong to every tab bar;
// a surface may add its own without touching the strip.

export type WorkspaceTabAction = ActionItem;

export type WorkspaceTabActionDecl = WorkspaceTabAction & {
	run: (tab: SurfaceTab) => void;
};

export type WorkspaceTabActionProvider = (
	tab: SurfaceTab,
) => WorkspaceTabActionDecl[];

export const workspaceTabActionInvoked = createEvent<{
	key: string;
	actionId: string;
}>("WORKSPACE_TAB_ACTION_INVOKED");

const providerRegistered = createEvent<{
	surface: string;
	provider: WorkspaceTabActionProvider;
}>("WORKSPACE_TAB_ACTIONS_REGISTERED");

const $providers = createStore<
	Readonly<Record<string, WorkspaceTabActionProvider>>
>({}, { name: "WORKSPACE_TAB_ACTION_PROVIDERS" }).on(
	providerRegistered,
	(providers, { surface, provider }) => ({ ...providers, [surface]: provider }),
);

export function registerWorkspaceTabActions(
	surface: string,
	provider: WorkspaceTabActionProvider,
): void {
	providerRegistered({ surface, provider });
}

/** What the strip adds after pin and close, without the handlers. */
export const $extraSurfaceActions = $providers.map(
	(providers): TabActionsOf =>
		(tab) =>
			(providers[tab.id]?.(tab) ?? []).map(
				({ run: _run, ...action }) => action,
			),
);

sample({
	clock: workspaceTabActionInvoked,
	filter: ({ actionId }) => actionId === PIN_ACTION,
	fn: ({ key }) => key,
	target: surfacePinToggled,
});
sample({
	clock: workspaceTabActionInvoked,
	filter: ({ actionId }) => actionId === CLOSE_ACTION,
	fn: ({ key }) => key,
	target: surfaceClosed,
});

const runActionFx = createEffect(
	({ action, tab }: { action: WorkspaceTabActionDecl; tab: SurfaceTab }) =>
		action.run(tab),
);

const actionFound = sample({
	clock: workspaceTabActionInvoked,
	source: { providers: $providers, tabs: $surfaceTabs },
	fn: ({ providers, tabs }, { key, actionId }) => {
		if (actionId === PIN_ACTION || actionId === CLOSE_ACTION) return undefined;
		const tab = tabs.find((entry) => entry.id === key);
		const action = tab
			? providers[key]?.(tab).find((entry) => entry.id === actionId)
			: undefined;
		if (!tab || !action) {
			console.warn(
				`[shell] unknown workspace tab action "${actionId}" for ${key}`,
			);
			return undefined;
		}
		return { action, tab };
	},
});

sample({ clock: actionFound.filterMap((run) => run), target: runActionFx });
