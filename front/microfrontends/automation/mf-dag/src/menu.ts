import { SHOW_CONTEXTS_LIST, SHOW_EXECUTIONS_LIST, SHOW_TASKS_LIST, SHOW_DAG_STATS, SHOW_VARS_LIST } from "./functions";

export const MENU = {
    "title": "menu.dag",
    "iconName": "IconAi",
    "action": SHOW_DAG_STATS,
    "items": [
        {
            "title": "menu.executions",
            "key": "executions",
            "action": SHOW_EXECUTIONS_LIST
        },
        {
            "title": "menu.tasks",
            "key": "tasks",
            "action": SHOW_TASKS_LIST
        },
        {
            "title": "menu.vars",
            "key": "vars",
            "action": SHOW_VARS_LIST
        }
    ]
};
