import {GetChatsListAction} from './actions';

export const MENU = {
    "title": "menu.chats",
 
    "iconName": "IconAi",
    "items": [
        {
            "title": "menu.text",
            "key": "text",
            "action": GetChatsListAction
        },
        {
            "title": "menu.audio",
            "key": "audio",
            "action": GetChatsListAction
        },
    ]
};