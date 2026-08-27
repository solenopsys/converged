import { CreateAction, CreateWidget } from "front-core";
import { ScriptsEditView } from "./views/ScriptsEditView";
import { ScriptsListView } from "./views/ScriptsListView";

const SHOW_SCRIPTS_LIST = "scripts.list";
const SHOW_SCRIPTS_EDIT = "scripts.edit";

const createScriptsListWidget: CreateWidget<typeof ScriptsListView> = (
	_bus,
) => ({
	view: ScriptsListView,
	placement: () => "center",
	config: {},
});

const createScriptsEditWidget: CreateWidget<typeof ScriptsEditView> = (
	_bus,
) => ({
	view: ScriptsEditView,
	placement: () => "center",
	config: {},
});

const createShowScriptsListAction: CreateAction<any> = (bus) => ({
	id: SHOW_SCRIPTS_LIST,
	llm: {
		microfrontend: "scripts-mf",
		brief: "llm.actions.scripts_list.brief",
		description: "llm.actions.scripts_list.description",
	},
	exposure: "user",
	priority: "normal",
	invoke: () => {
		bus.present({ widget: createScriptsListWidget(bus) });
	},
});

const createShowScriptsEditAction: CreateAction<any> = (bus) => ({
	id: SHOW_SCRIPTS_EDIT,
	llm: {
		microfrontend: "scripts-mf",
		brief: "llm.actions.scripts_edit.brief",
		description: "llm.actions.scripts_edit.description",
	},
	exposure: "llm",
	priority: "normal",
	invoke: () => {
		bus.present({ widget: createScriptsEditWidget(bus) });
	},
});

const ACTIONS = [createShowScriptsListAction, createShowScriptsEditAction];

export { SHOW_SCRIPTS_EDIT, SHOW_SCRIPTS_LIST };
export default ACTIONS;
