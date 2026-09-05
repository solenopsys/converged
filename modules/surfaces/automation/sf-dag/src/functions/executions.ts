import type { CreateAction } from "front-core";
import { presentReference, setRef } from "front-core/object-runtime";

const SHOW_EXECUTIONS_LIST = "executions.show_list";

const createShowExecutionsListAction: CreateAction = () => ({
	id: SHOW_EXECUTIONS_LIST,
	invoke: () => {
		void presentReference(setRef("dag.execution", { kind: "query" }));
	},
});

export { createShowExecutionsListAction, SHOW_EXECUTIONS_LIST };

const ACTIONS = [createShowExecutionsListAction];

export default ACTIONS;
