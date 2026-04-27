import { CreateAction, CreateWidget } from "front-core";
import { ThreadsView } from "./views/ThreadsView";

const SHOW_THREADS = "threads.show";

type ShowThreadsParams = {
  threadId?: string;
  threadIds?: string[];
  title?: string;
  userId?: string;
  placement?: "center" | "sidebar:right";
  variant?: "dashboard" | "thread";
};

const createThreadsWidget = (_bus: any, params?: ShowThreadsParams) => ({
  view: ThreadsView,
  placement: () => params?.placement ?? "center",
  config: params ?? {},
}) satisfies ReturnType<CreateWidget<typeof ThreadsView>>;

const createShowThreadsAction: CreateAction<any> = (bus) => ({
  id: SHOW_THREADS,
  description: "Show threads",
  invoke: (params?: ShowThreadsParams) => {
    bus.present({ widget: createThreadsWidget(bus, params), params });
  },
});

const ACTIONS = [createShowThreadsAction];

export { SHOW_THREADS, createShowThreadsAction };
export default ACTIONS;
