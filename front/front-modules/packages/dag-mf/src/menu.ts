import {ShowNodesListAction,ShowWorkflowsListAction,ShowProvidersListAction,ShowCodeSourceListAction} from './actions/lists';
export const MENU = {
    "title": "menu.dag",
    "iconName": "IconAi",
    "items": [
        {
            "title": "menu.workflows",
            "key": "workflows",
            "action":ShowWorkflowsListAction
        },
        {
            "title": "menu.nodes",
            "key": "nodes",
            "action":ShowNodesListAction
        },
        {
            "title": "menu.providers",
            "key": "providers",
            "action":ShowProvidersListAction
        },
        {
            "title": "menu.code",
            "key": "code",
            "action":ShowCodeSourceListAction
        }
    ]
};