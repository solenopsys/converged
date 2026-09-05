import type { CreateAction } from "front-core";
import { presentReference, setRef } from "front-core/object-runtime";

const SHOW_CONTEXTS_LIST = "contexts.show_list";

const createShowContextsListAction: CreateAction = () => ({
	id: SHOW_CONTEXTS_LIST,
	invoke: () =>
		void presentReference(setRef("dag.execution", { kind: "query" })),
});

export { createShowContextsListAction, SHOW_CONTEXTS_LIST };

const ACTIONS = [createShowContextsListAction];

export default ACTIONS;
