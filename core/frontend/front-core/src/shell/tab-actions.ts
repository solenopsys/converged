import { combine, createEvent, createStore } from "effector";
import type { ComponentType } from "preact";
import { translator } from "i18n";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";
import { Pin, Trash2, X } from "../icons";

const t = translator(CHAT_MESSAGES_NAMESPACE);
import {
	$workspace,
	type WorkspaceTab,
	workspaceTabClosed,
	workspaceTabPinToggled,
	workspaceUnpinnedTabsCleared,
} from "./workspace";


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
	run: (tab: WorkspaceTab) => void;
};

export type WorkspaceTabActionProvider = (
	tab: WorkspaceTab,
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

const providerRegistered = createEvent<string>("WORKSPACE_TAB_ACTIONS_REGISTERED");

const providers = new Map<string, WorkspaceTabActionProvider>();


export function registerWorkspaceTabActions(
	owner: string,
	provider: WorkspaceTabActionProvider,
): void {
	providers.set(owner, provider);
	providerRegistered(owner);
}

function baseActions(tab: WorkspaceTab): WorkspaceTabActionDecl[] {
	return [
		{
			id: "pin",
			label: tab.pinned ? t("tab.unpin") : t("tab.pin"),
			icon: Pin,
			run: (target) => workspaceTabPinToggled(target.key),
		},
		{
			id: "close",
			label: t("tab.close"),
			icon: X,
			run: (target) => workspaceTabClosed(target.key),
		},
		{
			id: "close-transient",
			label: t("tab.closeUnpinned"),
			icon: Trash2,
			danger: true,
			run: () => workspaceUnpinnedTabsCleared(),
		},
	];
}

function actionsFor(tab: WorkspaceTab): WorkspaceTabActionDecl[] {
	const extra = providers.get(tab.owner)?.(tab) ?? [];
	return [...baseActions(tab), ...extra];
}

const $providerRevision = createStore(0, {
	name: "WORKSPACE_TAB_ACTIONS_REVISION",
}).on(providerRegistered, (revision) => revision + 1);

export const $workspaceTabViews = combine(
	$workspace,
	$providerRevision,
	(state): WorkspaceTabView[] =>
		state.tabs.map((tab) => ({
			key: tab.key,
			title: tab.title,
			pinned: tab.pinned,
			active: tab.key === state.activeKey,
			actions: actionsFor(tab).map(({ run: _run, ...action }) => action),
		})),
);

workspaceTabActionInvoked.watch(({ key, actionId }) => {
	const tab = $workspace.getState().tabs.find((entry) => entry.key === key);
	if (!tab) return;

	const action = actionsFor(tab).find((entry) => entry.id === actionId);
	if (!action) {
		console.warn(`[shell] unknown workspace tab action "${actionId}" for ${key}`);
		return;
	}

	action.run(tab);
});
