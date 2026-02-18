import { CreateAction, CreateWidget } from "front-core";
import { ThreadsView } from "./views/ThreadsView";

const SHOW_THREADS = "threads.show";

const createThreadsWidget: CreateWidget<typeof ThreadsView> = (_bus) => ({
  view: ThreadsView,
  placement: () => "center",
  config: {},
});

const createShowThreadsAction: CreateAction<any> = (bus) => ({
  id: SHOW_THREADS,
  description: "Show threads",
  invoke: () => {
    bus.present({ widget: createThreadsWidget(bus) });
  },
});

const ACTIONS = [createShowThreadsAction];

export { SHOW_THREADS, createShowThreadsAction };
export default ACTIONS;
