
import { ShowOutgoingMailsAction,ShowIncomingMailsAction ,ShowWarmMailsAction,ShowCredentialsAction,ShowSendMailFormAction} from "./actions";

export const MENU = {
    "title": "menu.mailing", 
    "iconName": "IconAi",
    "routes":{
        "outgoing": {
            "title": "menu.outgoing",
            "key": "outgoing",
            "action":ShowOutgoingMailsAction
        },
        "incoming": {
            "title": "menu.incoming",
            "key": "incoming",
            "action":ShowIncomingMailsAction
        },
        "warm": {
            "title": "menu.warm",
            "key": "warm",
            "action":ShowWarmMailsAction
        },
        "send": {
            "title": "menu.send",
            "key": "send",
            "action":ShowSendMailFormAction
        },
        "credentials": {
            "title": "menu.credentials",
            "key": "credentials",
            "action":ShowCredentialsAction
        }
    }
};

