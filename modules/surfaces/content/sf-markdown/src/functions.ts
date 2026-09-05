import type { CreateAction, CreateWidget } from "front-core";
import { presentReference, setRef } from "front-core/object-runtime";
import { MdEditView } from "./views/MdEditView";

const SHOW_MD_LIST = "markdown.list";
const SHOW_MD_EDIT = "markdown.edit";

const createMdEditWidget: CreateWidget<typeof MdEditView> = (_bus) => ({
	view: MdEditView,
	placement: () => "center",
	config: {},
});

const createShowMdListAction: CreateAction = () => ({
	id: SHOW_MD_LIST,
	invoke: () => {
		void presentReference(setRef("markdown.document", { kind: "query" }));
	},
});

const createShowMdEditAction: CreateAction = (bus) => ({
	id: SHOW_MD_EDIT,
	invoke: () => {
		bus.present({ widget: createMdEditWidget(bus) });
	},
});

const ACTIONS = [createShowMdListAction, createShowMdEditAction];

export { SHOW_MD_EDIT, SHOW_MD_LIST };
export default ACTIONS;
