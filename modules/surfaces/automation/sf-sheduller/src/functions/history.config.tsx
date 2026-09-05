import type { CreateAction } from "front-core";
import { presentReference, setRef } from "front-core/object-runtime";

const SHOW_HISTORY = "sheduller.history.show";

const createShowHistoryAction: CreateAction = () => ({
	id: SHOW_HISTORY,
	invoke: () => {
		void presentReference(setRef("scheduler.history", { kind: "query" }));
	},
});

export { createShowHistoryAction, SHOW_HISTORY };

const ACTIONS = [createShowHistoryAction];

export default ACTIONS;
