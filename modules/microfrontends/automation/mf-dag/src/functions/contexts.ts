import type { CreateAction, CreateWidget } from "front-core";
import { ContextsView } from "../views/ContextsView";

const SHOW_CONTEXTS_LIST = "contexts.show_list";

const createContextsWidget: CreateWidget<typeof ContextsView> = (bus) => ({
	view: ContextsView,
	placement: () => "center",
	config: {
		bus: bus,
	},
	commands: {},
});

const createShowContextsListAction: CreateAction<any> = (bus) => ({
	id: SHOW_CONTEXTS_LIST,
	invoke: () => {
		bus.present({ widget: createContextsWidget(bus) });
	},
});

export { createShowContextsListAction, SHOW_CONTEXTS_LIST };

const ACTIONS = [createShowContextsListAction];

export default ACTIONS;
