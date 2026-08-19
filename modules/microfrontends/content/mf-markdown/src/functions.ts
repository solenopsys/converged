import { CreateAction, CreateWidget } from "front-core";
import { MdListView } from "./views/MdListView";
import { MdEditView } from "./views/MdEditView";

const SHOW_MD_LIST = "markdown.list";
const SHOW_MD_EDIT = "markdown.edit";

const createMdListWidget: CreateWidget<typeof MdListView> = (_bus) => ({
  view: MdListView,
  placement: () => "center",
  config: {},
});

const createMdEditWidget: CreateWidget<typeof MdEditView> = (_bus) => ({
  view: MdEditView,
  placement: () => "center",
  config: {},
});

const createShowMdListAction: CreateAction<any> = (bus) => ({
  id: SHOW_MD_LIST,
  description: "Show markdown files list",
  invoke: () => {
    bus.present({ widget: createMdListWidget(bus) });
  },
});

const createShowMdEditAction: CreateAction<any> = (bus) => ({
  id: SHOW_MD_EDIT,
  description: "Edit markdown file",
  invoke: () => {
    bus.present({ widget: createMdEditWidget(bus) });
  },
});

const ACTIONS = [createShowMdListAction, createShowMdEditAction];

export { SHOW_MD_LIST, SHOW_MD_EDIT };
export default ACTIONS;
