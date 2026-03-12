import { CreateAction, CreateWidget } from "front-core";
import { VarsView } from "../views/VarsView";

const SHOW_VARS_LIST = "vars.show_list";

const createVarsWidget: CreateWidget<typeof VarsView> = (bus) => ({
  view: VarsView,
  placement: () => "center",
  config: { bus },
  commands: {},
});

const createShowVarsListAction: CreateAction<any> = (bus) => ({
  id: SHOW_VARS_LIST,
  description: "Show vars list",
  invoke: () => {
    bus.present({ widget: createVarsWidget(bus) });
  },
});

export { SHOW_VARS_LIST, createShowVarsListAction };

const ACTIONS = [createShowVarsListAction];

export default ACTIONS;
