import { CreateAction, CreateWidget } from "front-core";
import { ThreadsStatsView } from "./views/ThreadsStatsView";
import { ThreadsView } from "./views/ThreadsView";

const SHOW_THREADS = "threads.show";
const VIEW_THREAD = "threads.view";

type ShowThreadsParams = {
  threadId?: string;
  threadIds?: string[];
  title?: string;
  userId?: string;
  placement?: "center" | "sidebar:right";
  variant?: "dashboard" | "thread";
};

// Default menu entry: the stats dashboard (simple indicators), not the raw panel.
const createThreadsStatsWidget = (_bus: any) => ({
  view: ThreadsStatsView,
  placement: () => "center" as const,
  config: {},
}) satisfies ReturnType<CreateWidget<typeof ThreadsStatsView>>;

// Drill-down into a concrete thread (used from chats/calls), not a list.
const createThreadsWidget = (_bus: any, params?: ShowThreadsParams) => ({
  view: ThreadsView,
  placement: () => params?.placement ?? "center",
  config: params ?? {},
}) satisfies ReturnType<CreateWidget<typeof ThreadsView>>;

const createShowThreadsAction: CreateAction<any> = (bus) => ({
  id: SHOW_THREADS,
  description: "Show threads dashboard",
  invoke: () => {
    bus.present({ widget: createThreadsStatsWidget(bus) });
  },
});

const createViewThreadAction: CreateAction<any> = (bus) => ({
  id: VIEW_THREAD,
  description: "View a single thread",
  invoke: (params?: ShowThreadsParams) => {
    bus.present({ widget: createThreadsWidget(bus, params), params });
  },
});

const ACTIONS = [createShowThreadsAction, createViewThreadAction];

export {
  SHOW_THREADS,
  VIEW_THREAD,
  createShowThreadsAction,
  createViewThreadAction,
};
export default ACTIONS;
