import { useMemo, type ReactNode } from "react";
import { ListTree, MessageSquare } from "lucide-react";
import { useUnit } from "effector-react";
import {
	$activeScreenId,
	$activeTabId,
	$branding,
	$composerValue,
	$menuLinks,
	$screens,
	$tabs,
	$tabContents,
	CHAT_TAB_ID,
	MENU_TAB_ID,
	chatOpenRequested,
	composerAttachRequested,
	composerCleared,
	composerValueChanged,
	screenActivated,
	screenClosed,
	tabActivated,
	type PanelTab,
} from "../../landing-common/control-panel-model";
import { useGlobalTranslation } from "../../hooks/global_i18n";
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
	const [branding, screens, activeScreenId, shortcuts, composer, userTabs, activeTabId, dynamicTabContents] = useUnit([
		$branding,
		$screens,
		$activeScreenId,
		$menuLinks,
		$composerValue,
		$tabs,
		$activeTabId,
		$tabContents,
	]);

	// Localize menu labels via the shared "nav" namespace. Re-renders on
	// languageChanged (the hook subscribes), so labels follow the locale switch.
	const { t } = useGlobalTranslation("nav");
	const localizedShortcuts = shortcuts.map((link) => ({
		href: link.href,
		label: link.labelKey ? t(link.labelKey, link.label) : link.label,
	}));

	const tabs = useMemo<PanelTab[]>(
		() => {
			const reserved = new Set([CHAT_TAB_ID, MENU_TAB_ID]);
			const hasMenuTab = Boolean(menuSlot || tabContents?.[MENU_TAB_ID]);
			const isMountedTab = (tab: PanelTab) =>
				Boolean(tabContents?.[tab.id] ?? dynamicTabContents[tab.id]);
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
				...userTabs.filter((tab) => !reserved.has(tab.id) && isMountedTab(tab)),
			];
		},
		[userTabs, chatTab?.icon, chatTab?.label, menuSlot, tabContents, dynamicTabContents],
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
			shortcuts={localizedShortcuts}
			onShortcutClick={(href) => {
				const navigationEvent = new CustomEvent("front-core:navigate-fragment", {
					cancelable: true,
					detail: { href },
				});
				window.dispatchEvent(navigationEvent);
				if (!navigationEvent.defaultPrevented) {
					window.location.href = href;
				}
			}}
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
