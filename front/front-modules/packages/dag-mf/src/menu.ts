import {SHOW_WORKFLOWS_LIST} from "./functions/wokflow";
import {SHOW_NODES_LIST} from "./functions/node.config";
import {SHOW_PROVIDERS_LIST} from "./functions/provider.config";
import {SHOW_CODE_SOURCE_LIST} from "./functions/code-source.config";

export  const MENU = {
    "title": "menu.dag",
    "iconName": "IconAi",
    "items": [
        {
            "title": "menu.workflows",
            "key": "workflows",
            "action":SHOW_WORKFLOWS_LIST
        },
        {
            "title": "menu.nodes",
            "key": "nodes",
            "action":SHOW_NODES_LIST
        },
        {
            "title": "menu.providers",
            "key": "providers",
            "action":SHOW_PROVIDERS_LIST
        },
        {
            "title": "menu.code",
            "key": "code",
            "action":SHOW_CODE_SOURCE_LIST
        }
    ]
};