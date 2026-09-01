import type { RightPanelTab } from "sidebar-controller";

export type ChatPanelTabContext = {
	isAuthenticated: boolean;
	isDevelopment: boolean;
};

type ChatPanelTabDefinition = {
	id: RightPanelTab;
	label: string;
	requiresAuthentication?: boolean;
	available?: (context: ChatPanelTabContext) => boolean;
};

const chatPanelTabs: readonly ChatPanelTabDefinition[] = [
	{ id: "views", label: "Saved", requiresAuthentication: true },
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
