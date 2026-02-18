import { createEvent, createEffect, forward, split, createStore, sample } from "effector"

 
// effector-событие для всех изменений адреса
export const locationChanged = createEvent<Location>();

// подписка на события браузера
window.addEventListener("popstate", () => locationChanged(window.location));
window.addEventListener("hashchange", () => locationChanged(window.location));

// первый эмит при старте
locationChanged(window.location);

locationChanged.watch((loc) => {
    console.log("URL изменился:", loc.pathname, loc.search, loc.hash);
  });