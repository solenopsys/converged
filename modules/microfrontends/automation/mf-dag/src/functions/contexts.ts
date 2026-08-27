import { CreateAction, CreateWidget } from "front-core";
import { ContextsView } from "../views/ContextsView";

const SHOW_CONTEXTS_LIST = "contexts.show_list";

const createContextsWidget: CreateWidget<typeof ContextsView> = (bus) => ({
  view: ContextsView,
  placement: () => "center",
  config: {
    bus: bus,
  },
  commands: {},
});

const createShowContextsListAction: CreateAction<any> = (bus) => ({
  id: SHOW_CONTEXTS_LIST,
  llm: {
    microfrontend: "dag-mf",
    brief: "llm.actions.contexts_show_list.brief",
    description: "llm.actions.contexts_show_list.description",
  },
  exposure: "user",
  priority: "normal",
  invoke: () => {
    bus.present({ widget: createContextsWidget(bus) });
  },
});

export { SHOW_CONTEXTS_LIST, createShowContextsListAction };

const ACTIONS = [createShowContextsListAction];

export default ACTIONS;
