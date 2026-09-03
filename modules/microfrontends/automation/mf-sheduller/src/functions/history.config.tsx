import type { CreateAction, CreateWidget } from "front-core";
import { HistoryView } from "../views/HistoryView";

const SHOW_HISTORY = "sheduller.history.show";

const createHistoryWidget: CreateWidget<typeof HistoryView> = (bus) => ({
	view: HistoryView,
	placement: () => "center",
	config: {
		bus,
	},
});

const createShowHistoryAction: CreateAction<any> = (bus) => ({
	id: SHOW_HISTORY,
	invoke: () => {
		bus.present({ widget: createHistoryWidget(bus) });
	},
});

export { createShowHistoryAction, SHOW_HISTORY };

const ACTIONS = [createShowHistoryAction];

export default ACTIONS;
