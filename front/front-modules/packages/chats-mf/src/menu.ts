import {createGetChatsListAction} from './functions';

export const MENU = {
    "title": "menu.chats",
 
    "iconName": "IconAi",
    "items": [
        {
            "title": "menu.text",
            "key": "text",
            "action": createGetChatsListAction
        },
        {
            "title": "menu.audio",
            "key": "audio",
            "action": createGetChatsListAction
        },
    ]
};  