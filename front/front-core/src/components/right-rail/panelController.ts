import { createEvent, createStore, sample } from "effector";
import type { PanelConfig } from "./panelTypes";

export type DeviceMode = "desktop" | "mobile";
export type LayoutId = "d1" | "d2" | "d3" | "d4" | "m1" | "m2" | "m3";
export type ActivePanel = "tabs" | "chat";

const transitionMs = 480;

export const setDevice = createEvent<DeviceMode>();
export const setLayout = createEvent<LayoutId>();
const setLayoutInstant = createEvent<LayoutId>();
const setZLayout = createEvent<LayoutId>();
export const setActivePanel = createEvent<ActivePanel>();
export const setCollapsed = createEvent<boolean>();
export const toggleCollapsed = createEvent();
export const setParallel = createEvent<boolean>();
export const toggleParallel = createEvent();
export const setConstrained = createEvent<boolean>();
export const toggleConstrained = createEvent();

export const $device = createStore<DeviceMode>("desktop").on(setDevice, (_, next) => next);
export const $layoutId = createStore<LayoutId>("d1")
  .on(setLayout, (_, next) => next)
  .on(setLayoutInstant, (_, next) => next);
export const $zLayoutId = createStore<LayoutId>("d1")
  .on(setZLayout, (_, next) => next)
  .on(setLayoutInstant, (_, next) => next);
export const $activePanel = createStore<ActivePanel>("tabs").on(
  setActivePanel,
  (_, next) => next,
);
export const $collapsed = createStore(false)
  .on(setCollapsed, (_, next) => next)
  .on(toggleCollapsed, (state) => !state);
export const $parallel = createStore(false)
  .on(setParallel, (_, next) => next)
  .on(toggleParallel, (state) => !state);
export const $constrained = createStore(false)
  .on(setConstrained, (_, next) => next)
  .on(toggleConstrained, (state) => !state);

export const $panelConfig = createStore<PanelConfig>({
  tabs: {
    headerIcons: [],
    menuItems: [
      {
        title: "Services",
        iconName: "grid",
        items: [
          { title: "Security", action: "services.security" },
          { title: "Storage", action: "services.storage" },
          { title: "Telemetry", action: "services.telemetry" },
        ],
      },
      {
        title: "Workflows",
        iconName: "nodes",
        items: [
          { title: "DAG", action: "workflows.dag" },
          { title: "Runs", action: "workflows.runs" },
        ],
      },
      {
        title: "Chat",
        iconName: "chat",
        action: "chat",
      },
      {
        title: "Settings",
        iconName: "settings",
        action: "settings",
      },
    ],
    icons: ["grid", "list", "nodes", "star"],
    footerIcon: "user",
  },
  chat: {
    title: "Ask us anything",
    description: "Our AI assistant will answer any questions about the club.",
    inputLabel: "Введите команду я выполню..",
    actions: ["add", "mic", "spark"],
    quickCommands: [
      { label: "Tell us about the club", icon: "message" },
      { label: "What projects have you delivered?", icon: "bolt" },
      { label: "How can I join?", icon: "spark" },
      { label: "Which plan is right for me?", icon: "message" },
      { label: "Can I migrate from Free to AI Portal?", icon: "spark" },
      { label: "Is there vendor lock-in?", icon: "bolt" },
      { label: "What is included in the Club plan?", icon: "message" },
    ],
  },
});

sample({
  clock: setDevice,
  fn: (device): LayoutId => (device === "desktop" ? "d1" : "m1"),
  target: setLayoutInstant,
});

sample({
  clock: setDevice,
  fn: (device) => device === "mobile",
  target: setCollapsed,
});

sample({
  clock: setDevice,
  fn: () => false,
  target: setParallel,
});

sample({
  clock: $constrained,
  filter: (value) => value,
  fn: () => false,
  target: [setParallel, setCollapsed],
});

const getLayoutGroup = (layout: LayoutId) => {
  if (layout === "d3") {
    return "parallel";
  }
  if (layout === "d4" || layout === "m3") {
    return "collapsed";
  }
  return "stacked";
};

const shouldDelayZSwap = (fromLayout: LayoutId, nextLayout: LayoutId) => {
  if (nextLayout === "d4" || nextLayout === "m3") {
    return false;
  }
  return getLayoutGroup(fromLayout) !== getLayoutGroup(nextLayout);
};

let pendingTimer: number | null = null;

sample({
  source: $layoutId,
  clock: setLayout,
  fn: (prev, next) => ({ prev, next }),
}).watch(({ prev, next }) => {
  if (pendingTimer && typeof window !== "undefined") {
    window.clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  if (!shouldDelayZSwap(prev, next)) {
    setZLayout(next);
    return;
  }
  if (typeof window === "undefined") {
    setZLayout(next);
    return;
  }
  pendingTimer = window.setTimeout(() => {
    setZLayout(next);
    pendingTimer = null;
  }, transitionMs);
});
