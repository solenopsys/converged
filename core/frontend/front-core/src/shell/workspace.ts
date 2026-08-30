import { createEvent, createStore, sample } from "effector";
import {
	type DomainRef,
	operationExecutionStarted,
} from "front-core/object-runtime";
import type { ComponentType } from "preact";
import {
	$composerPlacement,
	panelOpened,
	surfacePresenceChanged,
} from "./panel";

export type WorkspaceTab = {
	key: string;
	owner: string;
	/** Serializable domain identity used to restore the tab after a reload. */
	ref?: DomainRef;
	viewId?: string;
	title: string;
	view: ComponentType<Record<string, unknown>>;
	props: Record<string, unknown>;
	pinned: boolean;
};

export type OpenWorkspaceTab = Omit<WorkspaceTab, "pinned"> & {
	pinned?: boolean;
};

type WorkspaceState = {
	tabs: WorkspaceTab[];
	activeKey: string | null;
};

const initialState: WorkspaceState = { tabs: [], activeKey: null };

export const workspaceTabOpened = createEvent<OpenWorkspaceTab>(
	"WORKSPACE_TAB_OPENED",
);
export const workspaceTabActivated = createEvent<string>(
	"WORKSPACE_TAB_ACTIVATED",
);
export const workspaceTabClosed = createEvent<string>("WORKSPACE_TAB_CLOSED");
export const workspaceTabPinToggled = createEvent<string>(
	"WORKSPACE_TAB_PIN_TOGGLED",
);
export const workspaceUnpinnedTabsCleared = createEvent(
	"WORKSPACE_UNPINNED_TABS_CLEARED",
);
export const activeWorkspaceTabClosed = createEvent(
	"ACTIVE_WORKSPACE_TAB_CLOSED",
);
export const workspaceReset = createEvent("WORKSPACE_RESET");

export const $workspace = createStore<WorkspaceState>(initialState, {
	name: "WORKSPACE",
})
	.on(workspaceTabOpened, (state, tab) => {
		const index = state.tabs.findIndex((entry) => entry.key === tab.key);
		const next: WorkspaceTab = {
			...tab,
			pinned: tab.pinned ?? state.tabs[index]?.pinned ?? false,
		};
		const tabs =
			index === -1
				? [...state.tabs, next]
				: state.tabs.map((entry, position) =>
						position === index ? next : entry,
					);
		return { tabs, activeKey: next.key };
	})
	.on(workspaceTabActivated, (state, key) =>
		state.tabs.some((tab) => tab.key === key)
			? { ...state, activeKey: key }
			: state,
	)
	.on(workspaceTabClosed, (state, key) => {
		const index = state.tabs.findIndex((tab) => tab.key === key);
		if (index === -1) return state;
		const tabs = state.tabs.filter((tab) => tab.key !== key);
		const activeKey =
			state.activeKey === key
				? (tabs.at(Math.max(0, index - 1))?.key ?? null)
				: state.activeKey;
		return { tabs, activeKey };
	})
	.on(workspaceTabPinToggled, (state, key) => ({
		...state,
		tabs: state.tabs.map((tab) =>
			tab.key === key ? { ...tab, pinned: !tab.pinned } : tab,
		),
	}))
	.on(workspaceUnpinnedTabsCleared, (state) => {
		const tabs = state.tabs.filter((tab) => tab.pinned);
		return {
			tabs,
			activeKey: tabs.some((tab) => tab.key === state.activeKey)
				? state.activeKey
				: (tabs.at(-1)?.key ?? null),
		};
	})
	.on(activeWorkspaceTabClosed, (state) => {
		if (!state.activeKey) return state;
		const index = state.tabs.findIndex((tab) => tab.key === state.activeKey);
		const tabs = state.tabs.filter((tab) => tab.key !== state.activeKey);
		return { tabs, activeKey: tabs.at(Math.max(0, index - 1))?.key ?? null };
	})
	.reset(workspaceReset);

export const $workspaceTabs = $workspace.map((state) => state.tabs);
export const $activeWorkspaceTabKey = $workspace.map(
	(state) => state.activeKey,
);
export const $activeWorkspaceTab = $workspace.map(
	(state) => state.tabs.find((tab) => tab.key === state.activeKey) ?? null,
);
export const $workspaceHasTabs = $workspaceTabs.map((tabs) => tabs.length > 0);

sample({
	clock: $workspaceHasTabs,
	target: surfacePresenceChanged,
});

sample({
	clock: $workspaceHasTabs,
	source: $composerPlacement,
	filter: (placement, hasTabs) => hasTabs && placement === "hero",
	target: panelOpened,
});

operationExecutionStarted.watch(({ source }) => {
	if (source === "assistant") workspaceUnpinnedTabsCleared();
});
