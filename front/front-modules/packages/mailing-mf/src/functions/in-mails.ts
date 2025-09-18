import { TableView } from "converged-core";
import MailDetail from "../components/MailDetail";
import mailingService from "../service";
import { COLUMN_TYPES, CreateWidget, CreateAction, present } from 'converged-core';
import { sample } from "effector";
import domain from "../domain";
import { incomingColumns } from "./columns";
import { PaginationParams, PaginatedResult, Mail } from "./types";

const GET_INCOMING_MAILS = "incoming_mails.get";
const SHOW_INCOMING_MAILS = "incoming_mails.show";
const GET_WARM_MAILS = "warm_mails.get";
const SHOW_WARM_MAILS = "warm_mails.show";
const SHOW_MAIL_DETAIL = "mail_detail.show";


// Effects and Events
const listInMailsFx = domain.createEffect<PaginationParams, PaginatedResult<Mail>>(mailingService.listInMails);
const listWarmMailsFx = domain.createEffect<PaginationParams, PaginatedResult<Mail>>(mailingService.listWarmMails);
const getMailFx = domain.createEffect<string, object>(mailingService.getMail);

const openMailDetail = domain.createEvent<{ mailid: string }>();
const getIncomingMailsEvent = domain.createEvent<{ offset?: number; limit?: number }>();
const getWarmMailsEvent = domain.createEvent<{ offset?: number; limit?: number }>();

sample({ clock: openMailDetail, target: getMailFx });
sample({ clock: getIncomingMailsEvent, target: listInMailsFx });
sample({ clock: getWarmMailsEvent, target: listWarmMailsFx });

// Wrapper функции для использования в TableView
const inMailDataFunction = async (params: PaginationParams) => {
    return await mailingService.listInMails(params);
};

const warmMailDataFunction = async (params: PaginationParams) => {
    return await mailingService.listWarmMails(params);
};

const createIncomingMailsWidget: CreateWidget<typeof TableView> = (bus) => ({
    view: TableView,
    placement: () => "center",
    config: {
        columns: incomingColumns, // предполагаю, что это импортируется
        title: "Incoming Mails",
        dataFunction: inMailDataFunction,
        basePath: "/incoming",
        detailPath: "/mailing/incoming",
        defaultPageSize: 20,
        pageSizeOptions: [10, 20, 50, 100]
    },
    mount: () => {},
    commands: {
        onRowClick: (row: { id: number }) => {
            const mailid = row.id;
            bus.present(createMailDetailWidget(bus), { mailid });
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
        dataFunction: warmMailDataFunction,
        basePath: "/warm",
        detailPath: "/mailing/warm",
        defaultPageSize: 20,
        pageSizeOptions: [10, 20, 50, 100]
    },
    mount: () => {},
    commands: {
        onRowClick: (row: { id: number }) => {
            const mailid = row.id;
            bus.present(createMailDetailWidget(bus), { mailid });
            console.log("ROW CLICK", row);
        }
    }
});

const createMailDetailWidget: CreateWidget<typeof MailDetail> = () => ({
    view: MailDetail,
    placement: () => "right",
    mount: ({ mailid }) => {
        if (mailid == undefined) {
            console.error("MailDetailWidget mount: mailid is undefined");
            return null;
        } else {
            const mail = getMailFx(mailid);
            return mail;
        }
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
        return await mailingService.listInMails({ offset, limit });
    }
});

const createShowIncomingMailsAction: CreateAction<any> = (bus) => ({
    id: SHOW_INCOMING_MAILS,
    description: "Show incoming mails list",
    invoke: () => {
        bus.present(createIncomingMailsWidget(bus));
    }
});

const createGetWarmMailsAction: CreateAction<any> = () => ({
    id: GET_WARM_MAILS,
    description: "Get warm mails list",
    invoke: async ({ offset = 0, limit = 20 }) => {
        return await mailingService.listWarmMails({ offset, limit });
    }
});

const createShowWarmMailsAction: CreateAction<any> = (bus) => ({
    id: SHOW_WARM_MAILS,
    description: "Show warm mails list",
    invoke: () => {
        bus.present(createWarmMailsWidget(bus));
    }
});

const createShowMailDetailAction: CreateAction<any> = (bus) => ({
    id: SHOW_MAIL_DETAIL,
    description: "Show mail details",
    invoke: ({ mailid }) => {
        openMailDetail({ mailid });
        bus.present(createMailDetailWidget(bus));
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