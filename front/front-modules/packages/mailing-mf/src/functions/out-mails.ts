import MailForm from "src/components/MailForm";
import { TableView } from "converged-core";
import mailingService from "../service";
import { COLUMN_TYPES, CreateWidget, CreateAction, present } from 'converged-core';
import { sample } from "effector";
import { outgoingColumns } from "./columns";
import { createTableStore } from "converged-core";
import domain from "../domain";

const GET_OUTGOING_MAILS = "outgoing_mails.get";
const SHOW_OUTGOING_MAILS = "outgoing_mails.show";
const SHOW_SEND_MAIL_FORM = "outgoing_mails.send_form";
const SEND_MAIL = "outgoing_mails.send_mail";

// Интерфейсы
export interface PaginationParams {
    offset: number;
    limit: number;
}

export interface PaginatedResult<T> {
    items: T[];
    totalCount?: number;
}

export interface OutMail {
    id: string;
    subject: string;
    from: string;
    to: string;
    date: string;
}

// Effects and Events
// Effects and Events
const listOutMailsFx = domain.createEffect<PaginationParams, PaginatedResult<OutMail>>({name:'LIST_OUT_MAILS', handler: mailingService.listOutMails});
const sendMailFx = domain.createEffect<any, void>({name:'SEND_MAIL', handler: mailingService.sendMail});

const openMailDetail = domain.createEvent<{ mailid: string }>('OPEN_MAIL_DETAIL_EVENT');
const sendMailEvent = domain.createEvent<{ mail: any }>('SEND_MAIL_EVENT');
const getOutgoingMailsEvent = domain.createEvent<{ offset?: number; limit?: number }>('GET_OUTGOING_MAILS_EVENT');

sample({ clock: sendMailEvent, target: sendMailFx });
sample({ clock: getOutgoingMailsEvent, target: listOutMailsFx });

// Wrapper функция для использования в TableView
const outMailDataFunction = async (params: PaginationParams) => {
    return await mailingService.listOutMails(params);
};

const $outMailStore = createTableStore(domain, outMailDataFunction);
 
const createOutgoingMailsWidget: CreateWidget<typeof TableView> = (bus) => ({
    view: TableView,
    placement: () => "center",
    config: {
        columns: outgoingColumns,
        title: "Outgoing Mails",
        store: $outMailStore, 
        defaultPageSize: 20,
        pageSizeOptions: [10, 20, 50, 100]
    }, 
    commands: {
        onRowClick: (row: { id: number }) => {
            const mailid = row.id;
          //  bus.present(createMailDetailWidget(bus), { mailid });
            console.log("ROW CLICK", row);
        }
    }
});

const createSendMailFormWidget: CreateWidget<typeof MailForm> = () => ({
    view: MailForm,
    placement: () => "center", // todo "right"
  
    commands: {
        sendMail: (mail) => {
            sendMailFx(mail);
        },
        close: () => {
            // Handle close action
        }
    }
});

const createGetOutgoingMailsAction: CreateAction<any> = () => ({
    id: GET_OUTGOING_MAILS,
    description: "Get outgoing mails list",
    invoke: async ({ offset = 0, limit = 20 }) => {
        return await mailingService.listOutMails({ offset, limit });
    }
});

const createShowOutgoingMailsAction: CreateAction<any> = (bus) => ({
    id: SHOW_OUTGOING_MAILS,
    description: "Show outgoing mails list",
    invoke: () => {
        bus.present({widget:createOutgoingMailsWidget(bus)});
    }
});

const createShowSendMailFormAction: CreateAction<any> = (bus) => ({
    id: SHOW_SEND_MAIL_FORM,
    description: "Open send mail form",
    invoke: () => {
        bus.present({widget:createSendMailFormWidget(bus)});
    }
});

const createSendMailAction: CreateAction<any> = () => ({
    id: SEND_MAIL,
    description: "Send mail",
    invoke: (mail) => {
        sendMailFx(mail);
    }
});

const ACTIONS = [
    createGetOutgoingMailsAction,
    createShowOutgoingMailsAction,
    createShowSendMailFormAction,
    createSendMailAction
];

export {
    GET_OUTGOING_MAILS,
    SHOW_OUTGOING_MAILS,
    SHOW_SEND_MAIL_FORM,
    SEND_MAIL,
    createGetOutgoingMailsAction,
    createShowOutgoingMailsAction,
    createShowSendMailFormAction,
    createSendMailAction
};

export default ACTIONS;