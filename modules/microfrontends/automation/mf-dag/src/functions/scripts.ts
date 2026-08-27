import { type CreateAction, type CreateWidget } from "front-core";
import { ScriptsListView } from "../views/ScriptsListView";

const SHOW_SCRIPTS_LIST = "dag.scripts.list";

const createScriptsListWidget: CreateWidget<typeof ScriptsListView> = () => ({
	view: ScriptsListView,
	placement: () => "center",
	config: {},
});

const createShowScriptsListAction: CreateAction<any> = (bus) => ({
	id: SHOW_SCRIPTS_LIST,
	llm: {
		microfrontend: "dag-mf",
		brief: "llm.actions.dag_scripts_list.brief",
		description: "llm.actions.dag_scripts_list.description",
	},
	exposure: "user",
	priority: "normal",
	invoke: () => {
		bus.present({ widget: createScriptsListWidget(bus) });
	},
});

const ACTIONS = [createShowScriptsListAction];

export { SHOW_SCRIPTS_LIST };
export default ACTIONS;

