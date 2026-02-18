import { SHOW_CONTEXTS_LIST, SHOW_EXECUTIONS_LIST, SHOW_DAG_STATS } from "./functions";

export const MENU = {
    "title": "menu.dag",
    "iconName": "IconAi",
    "action": SHOW_DAG_STATS,
    "items": [
        {
            "title": "menu.contexts",
            "key": "contexts",
            "action": SHOW_CONTEXTS_LIST
        },
        {
            "title": "menu.executions",
            "key": "executions",
            "action": SHOW_EXECUTIONS_LIST
        }
    ]
};
