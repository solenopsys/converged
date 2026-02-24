import { createEvent } from "effector";

// effector-событие для всех изменений адреса
export const locationChanged = createEvent<Location>();

let started = false;
let stop: (() => void) | null = null;

const emitLocation = () => {
  if (typeof window === "undefined") return;
  locationChanged(window.location);
};

export const startLocationEvents = () => {
  if (typeof window === "undefined" || started) return;

  started = true;

  const onPopState = () => emitLocation();
  const onHashChange = () => emitLocation();

  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  const patchedPushState: History["pushState"] = function (data, unused, url) {
    originalPushState.call(window.history, data, unused, url);
    emitLocation();
  };

  const patchedReplaceState: History["replaceState"] = function (data, unused, url) {
    originalReplaceState.call(window.history, data, unused, url);
    emitLocation();
  };

  window.history.pushState = patchedPushState;
  window.history.replaceState = patchedReplaceState;
  window.addEventListener("popstate", onPopState);
  window.addEventListener("hashchange", onHashChange);

  // Первый эмит при старте
  emitLocation();

  stop = () => {
    window.removeEventListener("popstate", onPopState);
    window.removeEventListener("hashchange", onHashChange);
    window.history.pushState = originalPushState;
    window.history.replaceState = originalReplaceState;
    stop = null;
    started = false;
  };
};

export const stopLocationEvents = () => {
  stop?.();
};
