import { SHOW_CHATS_LIST, SHOW_CONTEXTS_LIST } from './functions';

export const MENU = {
    "title": "menu.chats",
    "iconName": "IconAi",
    "items": [
        {
            "title": "menu.text",
            "key": "text",
            "action": SHOW_CHATS_LIST
        },
        {
            "title": "menu.contexts",
            "key": "contexts",
            "action": SHOW_CONTEXTS_LIST
        },
    ]
};
