import { combine, createEvent, createStore } from "effector";
import { translator } from "i18n";
import type { ComponentType } from "preact";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";
import { Pin, X } from "../icons";
import {
	$surfaceTabs,
	type SurfaceTab,
	surfaceClosed,
	surfacePinToggled,
} from "./workspace";

const t = translator(CHAT_MESSAGES_NAMESPACE);

export type WorkspaceTabActionIcon = ComponentType<{
	size?: number;
	class?: string;
}>;

export type WorkspaceTabAction = {
	id: string;
	label: string;
	icon?: WorkspaceTabActionIcon;
	danger?: boolean;
};

export type WorkspaceTabActionDecl = WorkspaceTabAction & {
	run: (tab: SurfaceTab) => void;
};

export type WorkspaceTabActionProvider = (
	tab: SurfaceTab,
) => WorkspaceTabActionDecl[];

export type WorkspaceTabView = {
	key: string;
	title: string;
	pinned: boolean;
	active: boolean;
	actions: WorkspaceTabAction[];
};

export const workspaceTabActionInvoked = createEvent<{
	key: string;
	actionId: string;
}>("WORKSPACE_TAB_ACTION_INVOKED");

const providerRegistered = createEvent<string>(
	"WORKSPACE_TAB_ACTIONS_REGISTERED",
);

const providers = new Map<string, WorkspaceTabActionProvider>();

export function registerWorkspaceTabActions(
	surface: string,
	provider: WorkspaceTabActionProvider,
): void {
	providers.set(surface, provider);
	providerRegistered(surface);
}

function baseActions(tab: SurfaceTab): WorkspaceTabActionDecl[] {
	return [
		{
			// Pinning now means "keep this surface in the strip", the opposite of
			// what it meant when the strip showed only unpinned tabs and pinning
			// filed a view away in a panel.
			id: "pin",
			label: tab.pinned ? t("tab.unpin") : t("tab.pin"),
			icon: Pin,
			run: (target) => surfacePinToggled(target.id),
		},
		{
			id: "close",
			label: t("tab.close"),
			icon: X,
			run: (target) => surfaceClosed(target.id),
		},
	];
}

function actionsFor(tab: SurfaceTab): WorkspaceTabActionDecl[] {
	const extra = providers.get(tab.id)?.(tab) ?? [];
	return [...baseActions(tab), ...extra];
}

const $providerRevision = createStore(0, {
	name: "WORKSPACE_TAB_ACTIONS_REVISION",
}).on(providerRegistered, (revision) => revision + 1);

export const $workspaceTabViews = combine(
	$surfaceTabs,
	$providerRevision,
	(tabs): WorkspaceTabView[] =>
		tabs.map((tab) => ({
			key: tab.id,
			title: tab.label,
			pinned: tab.pinned,
			active: tab.active,
			actions: actionsFor(tab).map(({ run: _run, ...action }) => action),
		})),
);

workspaceTabActionInvoked.watch(({ key, actionId }) => {
	const tab = $surfaceTabs.getState().find((entry) => entry.id === key);
	if (!tab) return;

	const action = actionsFor(tab).find((entry) => entry.id === actionId);
	if (!action) {
		console.warn(
			`[shell] unknown workspace tab action "${actionId}" for ${key}`,
		);
		return;
	}

	action.run(tab);
});
