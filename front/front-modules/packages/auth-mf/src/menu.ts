
import { SHOW_LOGIN } from "./functions/login";
import { LOGOUT } from "./functions/logout"; 

export const MENU = {
    "title": "Login",
    "url": "#",
    "iconName": "IconAi",
    "items": [
        {
            "title": "Login",
            "key": "login",
            "action": SHOW_LOGIN
        },
        {
            "title": "Logout",
            "key": "logout",
            "action": LOGOUT
        } 
    ]
};
