
import { ShowLoginAction } from "./actions";
import { LogoutAction } from "./actions"; 

export const MENU = {
    "title": "Login",
    "url": "#",
    "iconName": "IconAi",
    "items": [
        {
            "title": "Login",
            "key": "login",
            "action": ShowLoginAction
        },
        {
            "title": "Logout",
            "key": "logout",
            "action": LogoutAction
        } 
    ]
};
