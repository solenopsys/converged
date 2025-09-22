import { TableView } from "converged-core"; 
import mailingService from "../service";
import { COLUMN_TYPES, CreateWidget, CreateAction, createTableStore } from 'converged-core';
import { sample } from "effector";
import domain from "../domain";
import { incomingColumns } from "./columns";
import { PaginationParams, PaginatedResult, Mail } from "./types";
import {MailDetailView} from "../views/MailDetailVeiw";

const GET_INCOMING_MAILS = "incoming_mails.get";
const SHOW_INCOMING_MAILS = "incoming_mails.show";
const GET_WARM_MAILS = "warm_mails.get";
const SHOW_WARM_MAILS = "warm_mails.show";
const SHOW_MAIL_DETAIL = "mail_detail.show";


// Effects and Events
const listInMailsFx = domain.createEffect<PaginationParams, PaginatedResult<Mail>>({name:'LIST_IN_MAILS', handler: mailingService.listInMails});
const listWarmMailsFx = domain.createEffect<PaginationParams, PaginatedResult<Mail>>({name:'LIST_WARM_MAILS', handler: mailingService.listWarmMails});
export const getMailFx = domain.createEffect<string, object>({name:'GET_MAIL', handler: ({ mailid }) => {
    console.log("GET_MAIL", mailid);
   return mailingService.getMail(mailid);
}});

const openMailDetail = domain.createEvent<{ mailid: string }>('OPEN_MAIL_DETAIL');
const getIncomingMailsEvent = domain.createEvent<{ offset?: number; limit?: number }>('GET_INCOMING_MAILS_EVENT');
const getWarmMailsEvent = domain.createEvent<{ offset?: number; limit?: number }>('GET_WARM_MAILS_EVENT');

sample({ clock: openMailDetail, target: getMailFx });
sample({ clock: getIncomingMailsEvent, target: listInMailsFx });
sample({ clock: getWarmMailsEvent, target: listWarmMailsFx });

const mailStore = domain.createStore(null);

sample({ clock: getMailFx.doneData, target: mailStore });

// Wrapper функции для использования в TableView
const inMailDataFunction = async (params: PaginationParams) => {
    return await mailingService.listInMails(params);
};

const warmMailDataFunction = async (params: PaginationParams) => {
    return await mailingService.listWarmMails(params);
};

const $inMailStore = createTableStore(domain, inMailDataFunction);
const $warmMailStore = createTableStore(domain, warmMailDataFunction);

const createIncomingMailsWidget: CreateWidget<typeof TableView> = (bus) => ({
    view: TableView,
    placement: () => "center",
    config: {
        columns: incomingColumns, // предполагаю, что это импортируется
        title: "Incoming Mails",
        store: $inMailStore,
        defaultPageSize: 20,
        pageSizeOptions: [10, 20, 50, 100]
    }, 
    commands: {
        onRowClick: (row: { id: number }) => {
            const mailid = row.id;

            openMailDetail({ mailid });
            bus.present({widget:createMailDetailWidget(bus), params: { mailid }});

            console.log("ROW CLICK", row);
        }
    }
});

const createWarmMailsWidget: CreateWidget<typeof TableView> = (bus) => ({
    view: TableView,
    placement: () => "center",
    config: {
        columns: incomingColumns, // предполагаю, что это импортируется
        title: "Warm Mails",
        store: $warmMailStore,
        
        defaultPageSize: 20,
        pageSizeOptions: [10, 20, 50, 100]
    }, 
    commands: {
        onRowClick: (row: { id: number }) => {
            const mailid = row.id;
            openMailDetail({ mailid });
            bus.present({widget:createMailDetailWidget(bus), params: { mailid }});

            console.log("ROW CLICK", row);
        }
    }
});

const createMailDetailWidget: CreateWidget<typeof MailDetailView> = () => ({
    view: MailDetailView,
    placement: () => "right",
    config: {
        mailStore :mailStore 
    },
    
    commands: {
        response: () => {
            // Handle response action
        },
        close: () => {
            // Handle close action
        }
    }
});

const createGetIncomingMailsAction: CreateAction<any> = () => ({
    id: GET_INCOMING_MAILS,
    description: "Get incoming mails list",
    invoke: async ({ offset = 0, limit = 20 }) => {
        getIncomingMailsEvent({ offset, limit });
        return await mailingService.listInMails({ offset, limit });
    }
});

const createShowIncomingMailsAction: CreateAction<any> = (bus) => ({
    id: SHOW_INCOMING_MAILS,
    description: "Show incoming mails list",
    invoke: () => {
        getIncomingMailsEvent({ offset: 0, limit: 20 });
        bus.present({widget:createIncomingMailsWidget(bus)});
    }
});

const createGetWarmMailsAction: CreateAction<any> = () => ({
    id: GET_WARM_MAILS,
    description: "Get warm mails list",
    invoke: async ({ offset = 0, limit = 20 }) => {
        getWarmMailsEvent({ offset, limit });
        return await mailingService.listWarmMails({ offset, limit });
    }
});

const createShowWarmMailsAction: CreateAction<any> = (bus) => ({
    id: SHOW_WARM_MAILS,
    description: "Show warm mails list",
    invoke: () => {
        getWarmMailsEvent({ offset: 0, limit: 20 });
        bus.present({widget:createWarmMailsWidget(bus)});
    }
});

const createShowMailDetailAction: CreateAction<any> = (bus) => ({
    id: SHOW_MAIL_DETAIL,
    description: "Show mail details",
    invoke: ({ mailid }) => {
        openMailDetail({ mailid });
        bus.present({widget:createMailDetailWidget(bus), params: { mailid }});
    }
});

const ACTIONS = [
    createGetIncomingMailsAction,
    createShowIncomingMailsAction,
    createGetWarmMailsAction,
    createShowWarmMailsAction,
    createShowMailDetailAction
];

export {
    GET_INCOMING_MAILS,
    SHOW_INCOMING_MAILS,
    GET_WARM_MAILS,
    SHOW_WARM_MAILS,
    SHOW_MAIL_DETAIL,
    createGetIncomingMailsAction,
    createShowIncomingMailsAction,
    createGetWarmMailsAction,
    createShowWarmMailsAction,
    createShowMailDetailAction,
    openMailDetail
};

export default ACTIONS;