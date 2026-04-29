"use client";

import { useUnit } from "effector-react";
import { useEffect } from "react";
import {
	$menuSectionsState,
	controllerInitialized,
	menuSectionToggled,
} from "sidebar-controller";
import type { MenuItem } from "../controllers/menu-store";
import { type MenuItemData, NavMainShell } from "./shell/NavMainShell";

const menuItemToMenuItemData = (item: MenuItem): MenuItemData => ({
	key:
		(typeof item.action === "string" ? item.action : item.action?.id) ||
		item.key ||
		item.title,
	actionKey: typeof item.action === "string" ? item.action : item.action?.id,
	title: item.title || "",
	icon: item.icon,
	href: item.href || item.url,
	items: item.items?.map(menuItemToMenuItemData),
});

const scrollToHashTarget = (hash: string) => {
	const rawId = hash.replace(/^#/, "");
	if (!rawId) return;
	let id = rawId;
	try {
		id = decodeURIComponent(rawId);
	} catch {
		id = rawId;
	}
	const target = document.getElementById(id);
	target?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const navigateToMenuHref = (href: string) => {
	if (typeof window === "undefined") return;

	const url = new URL(href, window.location.href);
	const sameDocument =
		url.origin === window.location.origin &&
		url.pathname === window.location.pathname &&
		url.search === window.location.search;

	if (!sameDocument) {
		window.location.href = url.toString();
		return;
	}

	if (!url.hash) return;

	if (window.location.hash === url.hash) {
		scrollToHashTarget(url.hash);
		return;
	}

	window.location.hash = url.hash;
};

export function NavMain({
	items,
	onSelect,
}: {
	items: MenuItem[];
	onSelect?: (actionId: string) => void;
}) {
	console.log("NavMain inside", items);

	const [menuState, initController, toggleMenuSection] = useUnit([
		$menuSectionsState,
		controllerInitialized,
		menuSectionToggled,
	]);

	useEffect(() => {
		initController();
	}, [initController]);

	const menuItems = items?.map(menuItemToMenuItemData) ?? [];
	const openSections = Object.entries(menuState)
		.filter(([, open]) => open)
		.map(([id]) => id);

	return (
		<NavMainShell
			items={menuItems}
			openSections={openSections}
			onSectionToggle={(key, open) => toggleMenuSection({ id: key, open })}
			onItemClick={(item) => {
				if (item.actionKey) {
					onSelect?.(item.actionKey);
					return;
				}
				if (item.href && typeof window !== "undefined") {
					navigateToMenuHref(item.href);
				}
			}}
		/>
	);
}
