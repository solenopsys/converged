import CONTEXTS_ACTIONS from "./contexts";
import EXECUTIONS_ACTIONS from "./executions";
import TASKS_ACTIONS from "./tasks";
import STATS_ACTIONS from "./stats";

export { SHOW_CONTEXTS_LIST } from "./contexts";
export { SHOW_EXECUTIONS_LIST } from "./executions";
export { SHOW_TASKS_LIST } from "./tasks";
export { SHOW_DAG_STATS } from "./stats";

const ACTIONS = [
    ...CONTEXTS_ACTIONS,
    ...EXECUTIONS_ACTIONS,
    ...TASKS_ACTIONS,
    ...STATS_ACTIONS,
];

export { ACTIONS };
