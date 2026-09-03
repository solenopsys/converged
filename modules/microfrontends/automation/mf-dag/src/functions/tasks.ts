import type { CreateAction, CreateWidget } from "front-core";
import { TasksView } from "../views/TasksView";

const SHOW_TASKS_LIST = "tasks.show_list";

const createTasksWidget: CreateWidget<typeof TasksView> = (bus) => ({
	view: TasksView,
	placement: () => "center",
	config: {
		bus: bus,
	},
	commands: {},
});

const createShowTasksListAction: CreateAction<any> = (bus) => ({
	id: SHOW_TASKS_LIST,
	invoke: () => {
		bus.present({ widget: createTasksWidget(bus) });
	},
});

export { createShowTasksListAction, createTasksWidget, SHOW_TASKS_LIST };

const ACTIONS = [createShowTasksListAction];

export default ACTIONS;
