import CONTEXTS_ACTIONS from "./contexts";
import EXECUTIONS_ACTIONS from "./executions";
import TASKS_ACTIONS from "./tasks";
import STATS_ACTIONS from "./stats";
import VARS_ACTIONS from "./vars";
import SCRIPTS_ACTIONS from "./scripts";

export { SHOW_CONTEXTS_LIST } from "./contexts";
export { SHOW_EXECUTIONS_LIST } from "./executions";
export { SHOW_TASKS_LIST } from "./tasks";
export { SHOW_DAG_STATS } from "./stats";
export { SHOW_VARS_LIST, SHOW_VAR_FORM } from "./vars";
export { SHOW_SCRIPTS_LIST } from "./scripts";

const ACTIONS = [
    ...CONTEXTS_ACTIONS,
    ...EXECUTIONS_ACTIONS,
    ...TASKS_ACTIONS,
    ...STATS_ACTIONS,
    ...VARS_ACTIONS,
    ...SCRIPTS_ACTIONS,
];

export { ACTIONS };
