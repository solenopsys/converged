import type { CreateAction } from "front-core";
import { presentReference, setRef } from "front-core/object-runtime";

const SHOW_TASKS_LIST = "tasks.show_list";

const createShowTasksListAction: CreateAction = () => ({
	id: SHOW_TASKS_LIST,
	invoke: () => void presentReference(setRef("dag.task", { kind: "query" })),
});

export { createShowTasksListAction, SHOW_TASKS_LIST };

const ACTIONS = [createShowTasksListAction];

export default ACTIONS;
