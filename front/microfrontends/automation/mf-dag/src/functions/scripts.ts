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
	description: "Show scripts list",
	invoke: () => {
		bus.present({ widget: createScriptsListWidget(bus) });
	},
});

const ACTIONS = [createShowScriptsListAction];

export { SHOW_SCRIPTS_LIST };
export default ACTIONS;

