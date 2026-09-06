import type { CreateAction } from "front-core";
import { presentReference, setRef } from "front-core/object-runtime";

const SHOW_SCRIPTS_LIST = "dag.scripts.list";

const createShowScriptsListAction: CreateAction = () => ({
	id: SHOW_SCRIPTS_LIST,
	invoke: () => void presentReference(setRef("dag.script", { kind: "query" })),
});

const ACTIONS = [createShowScriptsListAction];

export { SHOW_SCRIPTS_LIST };
export default ACTIONS;
