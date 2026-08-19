import { combine, createEvent, createStore } from "effector";
import type { ComponentType } from "preact";
import { Pin, Trash2, X } from "../icons";
import {
	$workspace,
	type WorkspaceTab,
	workspaceTabClosed,
	workspaceTabPinToggled,
	workspaceUnpinnedTabsCleared,
} from "./workspace";

/**
 * Верхняя панель — глупая: она получает готовый список вкладок с готовым
 * списком пунктов меню и умеет только сказать «нажали вот этот пункт вот у
 * этой вкладки». Что пункт делает, знает модель, поэтому новые действия
 * добавляются регистрацией, а не правкой панели.
 */
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

/**
 * Микрофронтенд владеет своими вкладками (owner) и может добавить к ним свои
 * пункты — «Обновить», «Экспорт», что угодно, — не трогая оболочку.
 */
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
			label: tab.pinned ? "Открепить" : "Закрепить",
			icon: Pin,
			run: (target) => workspaceTabPinToggled(target.key),
		},
		{
			id: "close",
			label: "Закрыть",
			icon: X,
			run: (target) => workspaceTabClosed(target.key),
		},
		{
			id: "close-transient",
			label: "Закрыть незакреплённые",
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
