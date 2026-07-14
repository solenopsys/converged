import { useUnit } from "effector-react";
import { ListTree, MessageSquare } from "lucide-react";
import {
	type PointerEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	$leftSidebarWidth,
	restoreState,
	sidebarWidthChanged,
} from "sidebar-controller";
import { requestMicrofrontendAction } from "../../controllers";
import { useGlobalTranslation } from "../../hooks/global_i18n";
import {
	$activeScreenId,
	$activeTabId,
	$branding,
	$composerValue,
	$menuLinks,
	$screens,
	$tabContents,
	$tabs,
	CHAT_TAB_ID,
	chatOpenRequested,
	composerAttachRequested,
	composerCleared,
	composerValueChanged,
	MENU_TAB_ID,
	type PanelTab,
	screenActivated,
	screenClosed,
	tabActivated,
} from "../../landing-common/control-panel-model";
import { ConvergedRailControlsIntegration } from "./ConvergedRailControlsIntegration";
import { ConvergedRailPanel } from "./ConvergedRailPanel";

const MIN_PANEL_WIDTH = 280;
const MAX_PANEL_WIDTH = 680;
const DEFAULT_PANEL_WIDTH = 380;

function clampPanelWidth(width: number): number {
	return Math.round(
		Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, width)),
	);
}

function applyControlPanelWidth(width: number) {
	if (typeof document === "undefined") return;
	const value = `${clampPanelWidth(width)}px`;
	document.documentElement.style.setProperty(
		"--ssr-control-panel-width",
		value,
	);
	document
		.getElementById("ssr-shell")
		?.style.setProperty("--ssr-control-panel-width", value);
	document
		.getElementById("app-shell")
		?.style.setProperty("--ssr-control-panel-width", value);
}

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
	const [
		branding,
		screens,
		activeScreenId,
		shortcuts,
		composer,
		userTabs,
		activeTabId,
		dynamicTabContents,
	] = useUnit([
		$branding,
		$screens,
		$activeScreenId,
		$menuLinks,
		$composerValue,
		$tabs,
		$activeTabId,
		$tabContents,
	]);
	const panelWidth = useUnit($leftSidebarWidth);
	const [isResizing, setIsResizing] = useState(false);
	const normalizedPanelWidth = clampPanelWidth(
		Number.isFinite(panelWidth) && panelWidth > 0
			? panelWidth
			: DEFAULT_PANEL_WIDTH,
	);

	useEffect(() => {
		restoreState();
	}, []);

	useEffect(() => {
		applyControlPanelWidth(normalizedPanelWidth);
	}, [normalizedPanelWidth]);

	const handleResizePointerDown = useCallback(
		(event: PointerEvent<HTMLButtonElement>) => {
			if (typeof window === "undefined") return;
			if (window.matchMedia("(max-width: 980px)").matches) return;

			event.preventDefault();
			event.stopPropagation();

			const startX = event.clientX;
			const startWidth = normalizedPanelWidth;
			const previousUserSelect = document.body.style.userSelect;
			const previousCursor = document.body.style.cursor;

			document.body.style.userSelect = "none";
			document.body.style.cursor = "col-resize";
			document
				.getElementById("app-shell")
				?.setAttribute("data-rail-resizing", "1");
			document
				.getElementById("ssr-shell")
				?.setAttribute("data-rail-resizing", "1");
			setIsResizing(true);

			try {
				event.currentTarget.setPointerCapture(event.pointerId);
			} catch {
				// ignore unsupported pointer capture cases
			}

			const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
				moveEvent.preventDefault();
				sidebarWidthChanged({
					side: "left",
					width: clampPanelWidth(startWidth + moveEvent.clientX - startX),
				});
			};

			const cleanup = () => {
				document.body.style.userSelect = previousUserSelect;
				document.body.style.cursor = previousCursor;
				document
					.getElementById("app-shell")
					?.removeAttribute("data-rail-resizing");
				document
					.getElementById("ssr-shell")
					?.removeAttribute("data-rail-resizing");
				setIsResizing(false);
				window.removeEventListener("pointermove", onPointerMove);
				window.removeEventListener("pointerup", onPointerUp);
				window.removeEventListener("pointercancel", onPointerCancel);
			};

			const onPointerUp = () => cleanup();
			const onPointerCancel = () => cleanup();

			window.addEventListener("pointermove", onPointerMove);
			window.addEventListener("pointerup", onPointerUp);
			window.addEventListener("pointercancel", onPointerCancel);
		},
		[normalizedPanelWidth],
	);

	// Localize menu labels via the shared "nav" namespace. Re-renders on
	// languageChanged (the hook subscribes), so labels follow the locale switch.
	const { t } = useGlobalTranslation("nav");
	const localizedShortcuts = shortcuts.map((link) => ({
		href: link.href,
		label: link.labelKey ? t(link.labelKey, link.label) : link.label,
	}));

	const tabs = useMemo<PanelTab[]>(() => {
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
				? [
						{
							id: MENU_TAB_ID,
							icon: <ListTree size={17} />,
							label: "Menu",
						},
					]
				: []),
			...userTabs.filter((tab) => !reserved.has(tab.id) && isMountedTab(tab)),
		];
	}, [
		userTabs,
		chatTab?.icon,
		chatTab?.label,
		menuSlot,
		tabContents,
		dynamicTabContents,
	]);

	const tabContent =
		activeTabId === CHAT_TAB_ID
			? undefined
			: activeTabId === MENU_TAB_ID
				? (tabContents?.[MENU_TAB_ID] ?? menuSlot)
				: (tabContents?.[activeTabId] ?? dynamicTabContents[activeTabId]);

	return (
		<ConvergedRailPanel
			logoLight={branding.logoLight}
			logoDark={branding.logoDark}
			phone={branding.phone}
			onCall={() => {
				void requestMicrofrontendAction("calls.web.start", {
					contextName: branding.contextName,
				});
			}}
			screens={screens}
			activeScreenId={activeScreenId}
			onScreenChange={screenActivated}
			onScreenClose={screenClosed}
			shortcuts={localizedShortcuts}
			onShortcutClick={(href) => {
				const navigationEvent = new CustomEvent(
					"front-core:navigate-fragment",
					{
						cancelable: true,
						detail: { href },
					},
				);
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
			onResizePointerDown={handleResizePointerDown}
			resizing={isResizing}
		/>
	);
}
