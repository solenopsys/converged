
import { ShowOutgoingMailsAction,ShowIncomingMailsAction ,ShowWarmMailsAction,ShowCredentialsAction,ShowSendMailFormAction} from "./actions";

export const MENU = {
    "title": "menu.mailing", 
    "iconName": "IconAi",
    "items":[
       {
            "title": "menu.outgoing",
            "key": "outgoing",
            "action":ShowOutgoingMailsAction
        },
         {
            "title": "menu.incoming",
            "key": "incoming",
            "action":ShowIncomingMailsAction
        },
         {
            "title": "menu.warm",
            "key": "warm",
            "action":ShowWarmMailsAction
        },
       {
            "title": "menu.send",
            "key": "send",
            "action":ShowSendMailFormAction
        },
       {
            "title": "menu.credentials",
            "key": "credentials",
            "action":ShowCredentialsAction
        }
    ]
};

