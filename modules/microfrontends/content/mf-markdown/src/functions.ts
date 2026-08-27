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
  llm: {
    microfrontend: "markdown-mf",
    brief: "llm.actions.markdown_list.brief",
    description: "llm.actions.markdown_list.description",
  },
  exposure: "user",
  priority: "normal",
  invoke: () => {
    bus.present({ widget: createMdListWidget(bus) });
  },
});

const createShowMdEditAction: CreateAction<any> = (bus) => ({
  id: SHOW_MD_EDIT,
  llm: {
    microfrontend: "markdown-mf",
    brief: "llm.actions.markdown_edit.brief",
    description: "llm.actions.markdown_edit.description",
  },
  exposure: "llm",
  priority: "normal",
  invoke: () => {
    bus.present({ widget: createMdEditWidget(bus) });
  },
});

const ACTIONS = [createShowMdListAction, createShowMdEditAction];

export { SHOW_MD_LIST, SHOW_MD_EDIT };
export default ACTIONS;
