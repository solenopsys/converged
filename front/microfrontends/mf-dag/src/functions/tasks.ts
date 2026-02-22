import { CreateAction, CreateWidget } from "front-core";
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
  description: "Show tasks list",
  invoke: () => {
    bus.present({ widget: createTasksWidget(bus) });
  },
});

export { SHOW_TASKS_LIST, createShowTasksListAction, createTasksWidget };

const ACTIONS = [createShowTasksListAction];

export default ACTIONS;
