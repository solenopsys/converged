import { CreateAction, CreateWidget } from "front-core";
import { GaleryListView } from "./views/GaleryListView";

const SHOW_GALERY_LIST = "galery.list";

const createGaleryListWidget: CreateWidget<typeof GaleryListView> = (_bus) => ({
  view: GaleryListView,
  placement: () => "center",
  config: {},
});

const createShowGaleryListAction: CreateAction<any> = (bus) => ({
  id: SHOW_GALERY_LIST,
  description: "Show galery items list",
  invoke: () => {
    bus.present({ widget: createGaleryListWidget(bus) });
  },
});

const ACTIONS = [createShowGaleryListAction];

export { SHOW_GALERY_LIST };
export default ACTIONS;
