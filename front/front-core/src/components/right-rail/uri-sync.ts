import { createEffect, createEvent, createStore, sample } from "effector";
import { $activeTab, tabActivated } from "sidebar-controller";
import { locationChanged, startLocationEvents } from "../../plugin/location-events";
import { registerActionEvent } from "../../controllers/effector-integration";
import { registry } from "../../controllers/registry";
import { $activePanel, setActivePanel, setCollapsed, type ActivePanel } from "./panelController";

const SIDEBAR_TAB_PARAM = "sidebarTab";
const SIDEBAR_PANEL_PARAM = "sidebarPanel";
const SIDEBAR_ACTION_PARAM = "sidebarAction";
const DEFAULT_TAB = "menu";
const DEFAULT_PANEL: ActivePanel = "tabs";

const tabFromLocationReceived = createEvent<string | null>();
const panelFromLocationReceived = createEvent<ActivePanel | null>();
const actionFromLocationParsed = createEvent<string | null>();
const actionFromLocationCommitted = createEvent<string | null>();
const pendingUriActionSet = createEvent<string | null>();
export const rightRailActionSelected = createEvent<string>();

let syncStarted = false;

const $lastUriAction = createStore<string | null>(null).on(
  actionFromLocationCommitted,
  (_, actionId) => actionId,
);
const $pendingUriAction = createStore<string | null>(null).on(
  pendingUriActionSet,
  (_, actionId) => actionId,
);

const normalizeTab = (value: string | null): string | null => {
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizePanel = (value: string | null): ActivePanel | null => {
  return value === "tabs" || value === "chat" ? value : null;
};

const normalizeAction = (value: string | null): string | null => {
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const replaceQueryParam = (key: string, value: string | null) => {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  if (!value) {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }

  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return;

  window.history.replaceState(window.history.state, "", next);
};

const syncTabToUriFx = createEffect((tab: string) => {
  const normalized = normalizeTab(tab);
  replaceQueryParam(
    SIDEBAR_TAB_PARAM,
    !normalized || normalized === DEFAULT_TAB ? null : normalized,
  );
});

const syncPanelToUriFx = createEffect((panel: ActivePanel) => {
  replaceQueryParam(SIDEBAR_PANEL_PARAM, panel === DEFAULT_PANEL ? null : panel);
});

const syncActionToUriFx = createEffect((actionId: string) => {
  replaceQueryParam(SIDEBAR_ACTION_PARAM, normalizeAction(actionId));
});

const runActionFromUriFx = createEffect((actionId: string): boolean => {
  if (typeof window === "undefined") return false;

  // Deep-link should always reveal the right menu panel.
  setCollapsed(false);
  setActivePanel("tabs");

  const action = registry.get(actionId);
  if (!action) return false;

  try {
    registry.run(actionId, {});
    return true;
  } catch (error) {
    console.error("[right-rail uri-sync] failed to run action", actionId, error);
    return false;
  }
});

sample({
  clock: locationChanged,
  fn: (location) => normalizeTab(new URLSearchParams(location.search).get(SIDEBAR_TAB_PARAM)),
  target: tabFromLocationReceived,
});

sample({
  clock: locationChanged,
  fn: (location) => normalizePanel(new URLSearchParams(location.search).get(SIDEBAR_PANEL_PARAM)),
  target: panelFromLocationReceived,
});

sample({
  source: $lastUriAction,
  clock: locationChanged,
  filter: (lastAction, location) => {
    const nextAction = normalizeAction(
      new URLSearchParams(location.search).get(SIDEBAR_ACTION_PARAM),
    );
    return lastAction !== nextAction;
  },
  fn: (_, location) =>
    normalizeAction(new URLSearchParams(location.search).get(SIDEBAR_ACTION_PARAM)),
  target: actionFromLocationParsed,
});

sample({
  clock: tabFromLocationReceived,
  filter: (tab): tab is string => Boolean(tab),
  target: tabActivated,
});

sample({
  clock: panelFromLocationReceived,
  filter: (panel): panel is ActivePanel => panel !== null,
  target: setActivePanel,
});

sample({
  clock: actionFromLocationParsed,
  target: actionFromLocationCommitted,
});

sample({
  clock: actionFromLocationParsed,
  target: pendingUriActionSet,
});

sample({
  clock: actionFromLocationParsed,
  filter: (action): action is string => Boolean(action),
  target: runActionFromUriFx,
});

sample({
  source: $pendingUriAction,
  clock: registerActionEvent,
  filter: (pendingActionId, action) => Boolean(pendingActionId) && action.id === pendingActionId,
  fn: (pendingActionId) => pendingActionId as string,
  target: runActionFromUriFx,
});

sample({
  source: $pendingUriAction,
  clock: runActionFromUriFx.doneData,
  filter: (pendingActionId, isRun) => Boolean(pendingActionId) && isRun,
  fn: () => null,
  target: pendingUriActionSet,
});

sample({
  clock: $activeTab.updates,
  target: syncTabToUriFx,
});

sample({
  clock: $activePanel.updates,
  target: syncPanelToUriFx,
});

sample({
  clock: rightRailActionSelected,
  fn: (actionId) => normalizeAction(actionId),
  target: actionFromLocationCommitted,
});

sample({
  clock: rightRailActionSelected,
  target: syncActionToUriFx,
});

export const startRightRailUriSync = () => {
  if (typeof window === "undefined" || syncStarted) return;
  syncStarted = true;
  startLocationEvents();
};
