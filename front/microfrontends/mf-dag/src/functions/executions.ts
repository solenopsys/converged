import { CreateAction, CreateWidget } from "front-core";
import { ExecutionsView } from "../views/ExecutionsView";

const SHOW_EXECUTIONS_LIST = "executions.show_list";

const createExecutionsWidget: CreateWidget<typeof ExecutionsView> = (bus) => ({
  view: ExecutionsView,
  placement: () => "center",
  config: {
    bus: bus,
  },
  commands: {},
});

const createShowExecutionsListAction: CreateAction<any> = (bus) => ({
  id: SHOW_EXECUTIONS_LIST,
  description: "Show executions list",
  invoke: () => {
    bus.present({ widget: createExecutionsWidget(bus) });
  },
});

export { SHOW_EXECUTIONS_LIST, createShowExecutionsListAction };

const ACTIONS = [createShowExecutionsListAction];

export default ACTIONS;
