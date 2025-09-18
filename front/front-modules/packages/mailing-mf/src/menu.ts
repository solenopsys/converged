import { SHOW_OUTGOING_MAILS } from "./functions";
import { SHOW_INCOMING_MAILS } from "./functions";
import { SHOW_WARM_MAILS } from "./functions";
import { SHOW_CREDENTIALS } from "./functions";
import { SHOW_SEND_MAIL_FORM } from "./functions";
 
export const MENU = {
    "title": "menu.mailing", 
    "iconName": "IconAi",
    "items":[
       {
            "title": "menu.outgoing",
            "key": "outgoing",
            "action":  SHOW_OUTGOING_MAILS
        },
         {
            "title": "menu.incoming",
            "key": "incoming",
            "action":SHOW_INCOMING_MAILS
        },
         {
            "title": "menu.warm",
            "key": "warm",
            "action":SHOW_WARM_MAILS
        },
       {
            "title": "menu.send",
            "key": "send",
            "action":SHOW_SEND_MAIL_FORM
        },
       {
            "title": "menu.credentials",
            "key": "credentials",
            "action":SHOW_CREDENTIALS
        }
    ]
};

