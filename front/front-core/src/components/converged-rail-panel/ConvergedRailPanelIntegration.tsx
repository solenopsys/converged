import { useMemo, type ReactNode } from "react";
import { ListTree, MessageSquare } from "lucide-react";
import { useUnit } from "effector-react";
import {
	$activeScreenId,
	$activeTabId,
	$branding,
	$composerValue,
	$panelActions,
	$screens,
	$tabs,
	$tabContents,
	CHAT_TAB_ID,
	MENU_TAB_ID,
	chatOpenRequested,
	composerAttachRequested,
	composerCleared,
	composerValueChanged,
	panelActionTriggered,
	screenActivated,
	screenClosed,
	tabActivated,
	type PanelTab,
} from "../../landing-common/control-panel-model";
import { ConvergedRailPanel } from "./ConvergedRailPanel";
import { ConvergedRailControlsIntegration } from "./ConvergedRailControlsIntegration";

export interface ConvergedRailPanelIntegrationProps {
	chatSlot?: ReactNode;
	menuSlot?: ReactNode;
	composerPlaceholder?: string;
	/** Content for non-chat tabs, keyed by tab id. */
	tabContents?: Record<string, ReactNode>;
	/** Override the implicit chat tab metadata (icon/label). */
	chatTab?: Partial<Omit<PanelTab, "id">>;
}

export function ConvergedRailPanelIntegration({
	chatSlot,
	menuSlot,
	composerPlaceholder = "Describe your CNC request...",
	tabContents,
	chatTab,
}: ConvergedRailPanelIntegrationProps) {
	const [branding, screens, activeScreenId, actions, composer, userTabs, activeTabId, dynamicTabContents] = useUnit([
		$branding,
		$screens,
		$activeScreenId,
		$panelActions,
		$composerValue,
		$tabs,
		$activeTabId,
		$tabContents,
	]);

	const tabs = useMemo<PanelTab[]>(
		() => {
			const reserved = new Set([CHAT_TAB_ID, MENU_TAB_ID]);
			const hasMenuTab = Boolean(menuSlot || tabContents?.[MENU_TAB_ID]);
			return [
				{
					id: CHAT_TAB_ID,
					icon: chatTab?.icon ?? <MessageSquare size={17} />,
					label: chatTab?.label ?? "Chat",
				},
				...(hasMenuTab
					? [{
						id: MENU_TAB_ID,
						icon: <ListTree size={17} />,
						label: "Menu",
					}]
					: []),
				...userTabs.filter((tab) => !reserved.has(tab.id)),
			];
		},
		[userTabs, chatTab?.icon, chatTab?.label, menuSlot, tabContents],
	);

	const tabContent =
		activeTabId === CHAT_TAB_ID
			? undefined
			: activeTabId === MENU_TAB_ID
				? tabContents?.[MENU_TAB_ID] ?? menuSlot
				: tabContents?.[activeTabId] ?? dynamicTabContents[activeTabId];

	return (
		<ConvergedRailPanel
			logoLight={branding.logoLight}
			logoDark={branding.logoDark}
			screens={screens}
			activeScreenId={activeScreenId}
			onScreenChange={screenActivated}
			onScreenClose={screenClosed}
			quickActions={actions}
			onQuickAction={panelActionTriggered}
			chatSlot={chatSlot}
			composerValue={composer}
			onComposerChange={composerValueChanged}
			onComposerSubmit={() => {
				const text = composer.trim();
				if (!text) return;
				chatOpenRequested(text);
				composerCleared();
			}}
			onComposerAttach={() => composerAttachRequested()}
			composerPlaceholder={composerPlaceholder}
			controls={<ConvergedRailControlsIntegration />}
			tabs={tabs}
			activeTabId={activeTabId}
			onTabChange={tabActivated}
			tabContent={tabContent}
		/>
	);
}
