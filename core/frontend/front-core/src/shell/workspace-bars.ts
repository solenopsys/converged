import { sample } from "effector";
import { translator } from "i18n";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";
import { Pin, X } from "../icons";
import { createTabBar, type TabBarModel, type TabBarText } from "../tabs";
import { $extraSurfaceActions, workspaceTabActionInvoked } from "./tab-actions";
import { menus, surfaces } from "./workspace";

// The workspace's two places, each drawn by generic tab bars. A place drawn in
// two spots — the top of the screen and the phone's navigation panel — gets a
// bar per spot, so opening the catalog in one does not open it in the other.

const t = translator(CHAT_MESSAGES_NAMESPACE);

const actionLabels = () => ({
	pin: t("tab.pin"),
	unpin: t("tab.unpin"),
	close: t("tab.close"),
});

function surfaceBar(name: string): TabBarModel {
	const bar = createTabBar({
		name,
		set: surfaces,
		labels: actionLabels,
		icons: { pin: Pin, close: X },
		$extraActions: $extraSurfaceActions,
	});
	sample({
		clock: bar.actionInvoked,
		fn: ({ id, actionId }) => ({ key: id, actionId }),
		target: workspaceTabActionInvoked,
	});
	return bar;
}

const menuBar = (name: string): TabBarModel =>
	createTabBar({
		name,
		set: menus.current,
		labels: actionLabels,
		icons: { pin: Pin, close: X },
	});

export const surfaceStrip = surfaceBar("SURFACE_STRIP");
export const surfaceMenuBar = menuBar("SURFACE_MENU_BAR");
export const navSurfaceList = surfaceBar("NAV_SURFACE_LIST");
export const navMenuList = menuBar("NAV_MENU_LIST");

const common = () => ({
	search: t("tab.search"),
	empty: t("tab.nothingFound"),
	pin: (title: string) => t("tab.pinNamed", { title }),
	unpin: (title: string) => t("tab.unpinNamed", { title }),
	close: (title: string) => t("tab.closeNamed", { title }),
	hint: t("tab.catalogHint"),
});

/** Resolved at render, so a language switch reaches the next paint. */
export const surfaceBarText = (): TabBarText => ({
	...common(),
	tabs: t("tab.sections"),
	label: t("tab.openSection"),
});

export const menuBarText = (): TabBarText => ({
	...common(),
	tabs: t("nav.current"),
	label: t("tab.openItem"),
});
