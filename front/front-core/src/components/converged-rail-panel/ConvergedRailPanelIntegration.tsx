import { useMemo, type ReactNode } from "react";
import { MessageSquare } from "lucide-react";
import { useUnit } from "effector-react";
import {
	$activeScreenId,
	$activeTabId,
	$branding,
	$composerValue,
	$panelActions,
	$screens,
	$tabs,
	CHAT_TAB_ID,
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
	const [branding, screens, activeScreenId, actions, composer, userTabs, activeTabId] = useUnit([
		$branding,
		$screens,
		$activeScreenId,
		$panelActions,
		$composerValue,
		$tabs,
		$activeTabId,
	]);

	const tabs = useMemo<PanelTab[]>(
		() => [
			{
				id: CHAT_TAB_ID,
				icon: chatTab?.icon ?? <MessageSquare size={17} />,
				label: chatTab?.label ?? "Chat",
			},
			...userTabs,
		],
		[userTabs, chatTab?.icon, chatTab?.label],
	);

	const tabContent = activeTabId !== CHAT_TAB_ID && tabContents ? tabContents[activeTabId] : undefined;

	return (
		<ConvergedRailPanel
			logoLight={branding.logoLight}
			logoDark={branding.logoDark}
			screens={screens}
			activeScreenId={activeScreenId}
			onScreenChange={screenActivated}
			onScreenClose={screenClosed}
			menuSlot={menuSlot}
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
