import { CreateAction, CreateWidget } from "front-core";
import { StructListView } from "./views/StructListView";

const SHOW_STRUCT_LIST = "struct.list";

const createStructListWidget: CreateWidget<typeof StructListView> = (_bus) => ({
  view: StructListView,
  placement: () => "center",
  config: {},
});

const createShowStructListAction: CreateAction<any> = (bus) => ({
  id: SHOW_STRUCT_LIST,
  description: "Show struct files list",
  invoke: () => {
    bus.present({ widget: createStructListWidget(bus) });
  },
});

const ACTIONS = [createShowStructListAction];

export { SHOW_STRUCT_LIST };
export default ACTIONS;
