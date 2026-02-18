// types.ts
import { type Action } from "../plugin/types_actions";
import { createDomainLogger } from "../../../libraries/effector-logger/logger";
import { sample } from "effector";
import type { ReactNode } from "react";



export interface MenuItem {
  key?: string;
  title?: string;
  action?: Action<any, any> | string;
  icon?: ReactNode | string;
  [key: string]: any;
}

export interface MenuData {
  id: string;
  items: MenuItem[];
}

// menu-store.ts
import {createDomain } from 'effector';

const domain = createDomain('navigation');

//logger
createDomainLogger(domain);


export const addMenuRequested = domain.createEvent<{ microfrontendId: string; menu: MenuItem[] }>();
export const removeMenuRequested = domain.createEvent<string>();
export const clearAllMenus = domain.createEvent();

// Стор для хранения всех меню
export const $menus = domain.createStore<MenuData[]>([]);

// Sample для обработки событий
sample({
  clock: addMenuRequested,
  source: $menus,
  fn: (currentMenus, { microfrontendId, menu }) => {
    console.log("addMenu", microfrontendId, menu);

    const filteredMenus = currentMenus.filter(m => m.id !== microfrontendId);
    const newMenus = [...filteredMenus, { id: microfrontendId, items: menu }];

    console.log('Menu added:', microfrontendId, menu);
    return newMenus;
  },
  target: $menus
});

sample({
  clock: removeMenuRequested,
  source: $menus,
  fn: (currentMenus, microfrontendId) => {
    console.log("removeMenu", microfrontendId);
    return currentMenus.filter(m => m.id !== microfrontendId);
  },
  target: $menus
});

sample({
  clock: clearAllMenus,
  fn: () => {
    console.log("clearAllMenus");
    return [];
  },
  target: $menus
});

// Производный стор для получения всех элементов меню
export const $allMenuItems = $menus.map((menus) => {
  console.log("getAllMenus-----------№№", menus);
  return menus.flatMap(m => m.items);
});
