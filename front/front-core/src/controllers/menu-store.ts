// types.ts

import { sample } from "effector";
import type { ReactNode } from "react";
import { createDomainLogger } from "../../../libraries/effector-logger/logger";
import type { Action } from "../plugin/types_actions";

export interface MenuItem {
	key?: string;
	title?: string;
	action?: Action<any, any> | string;
	icon?: ReactNode | string;
	__microfrontendId?: string;
	[key: string]: any;
}

export interface MenuData {
	id: string;
	items: MenuItem[];
}

// menu-store.ts
import { createDomain } from "effector";

const domain = createDomain("navigation");

//logger
createDomainLogger(domain);

export const addMenuRequested = domain.createEvent<{
	microfrontendId: string;
	menu: MenuItem[];
}>();
export const removeMenuRequested = domain.createEvent<string>();
export const clearAllMenus = domain.createEvent();

// Стор для хранения всех меню
export const $menus = domain.createStore<MenuData[]>([]);

// Sample для обработки событий
sample({
	clock: addMenuRequested,
	source: $menus,
	fn: (currentMenus, { microfrontendId, menu }) => {
		const filteredMenus = currentMenus.filter((m) => m.id !== microfrontendId);
		return [...filteredMenus, { id: microfrontendId, items: menu }];
	},
	target: $menus,
});

sample({
	clock: removeMenuRequested,
	source: $menus,
	fn: (currentMenus, microfrontendId) =>
		currentMenus.filter((m) => m.id !== microfrontendId),
	target: $menus,
});

sample({
	clock: clearAllMenus,
	fn: () => [],
	target: $menus,
});

// Производный стор для получения всех элементов меню
export const $allMenuItems = $menus.map((menus) =>
	menus.flatMap((m) => m.items),
);
