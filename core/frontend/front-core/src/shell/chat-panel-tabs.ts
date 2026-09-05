import type { RightPanelTab } from "sidebar-controller";

export type ChatPanelTabContext = {
	isAuthenticated: boolean;
	isDevelopment: boolean;
	/** Whether there is anything to navigate to in this session. */
	hasSurfaces?: boolean;
};

type ChatPanelTabDefinition = {
	id: RightPanelTab;
	label: string;
	requiresAuthentication?: boolean;
	available?: (context: ChatPanelTabContext) => boolean;
};

const chatPanelTabs: readonly ChatPanelTabDefinition[] = [
	// Navigation, not storage. On a phone the panel covers the viewport, so this
	// is the only way to reach the tab strip. It is not gated on a session —
	// a guest with public sections still has to be able to move between them —
	// but it does not appear when the session has nowhere to go, which for a
	// guest with no public surface is the usual case.
	{
		id: "navigation",
		label: "Menu",
		available: ({ hasSurfaces }) => hasSurfaces !== false,
	},
	{ id: "chat", label: "Chat" },
	{ id: "events", label: "Events", requiresAuthentication: true },
	{
		id: "trace",
		label: "Log",
		available: ({ isDevelopment }) => isDevelopment,
	},
];

export function availableChatPanelTabs(
	context: ChatPanelTabContext,
): readonly ChatPanelTabDefinition[] {
	return chatPanelTabs.filter(
		(tab) =>
			(!tab.requiresAuthentication || context.isAuthenticated) &&
			(tab.available?.(context) ?? true),
	);
}

export function resolveChatPanelTab(
	active: RightPanelTab,
	tabs: readonly ChatPanelTabDefinition[],
): RightPanelTab {
	return tabs.some((tab) => tab.id === active) ? active : "chat";
}
