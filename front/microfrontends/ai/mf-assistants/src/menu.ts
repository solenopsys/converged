import { SHOW_CHATS_LIST, SHOW_CONTEXTS_LIST, SHOW_COMMANDS_LIST } from './functions';

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
            "title": "menu.audio",
            "key": "audio",
            "action": SHOW_CHATS_LIST
        },
        {
            "title": "menu.contexts",
            "key": "contexts",
            "action": SHOW_CONTEXTS_LIST
        },
        {
            "title": "menu.commands",
            "key": "commands",
            "action": SHOW_COMMANDS_LIST
        },
    ]
};
