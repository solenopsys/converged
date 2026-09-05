import type { CreateAction } from "front-core";
import { presentReference, setRef } from "front-core/object-runtime";

const SHOW_STRUCT_LIST = "struct.list";

const createShowStructListAction: CreateAction = () => ({
	id: SHOW_STRUCT_LIST,
	invoke: () => {
		void presentReference(setRef("struct.node", { kind: "query" }));
	},
});

const ACTIONS = [createShowStructListAction];

export { SHOW_STRUCT_LIST };
export default ACTIONS;
