import MailForm from "src/components/MailForm";
import { TableView } from "converged-core";
import mailingService from "../service";
import { COLUMN_TYPES, Widget, Action } from 'converged-core';

import { createEvent, createEffect, createStore, sample } from "effector";

 

const outgoingColumns = [
    {
        id: 'subject',
        title: 'Тема', //todo в транслитерацию
        type: COLUMN_TYPES.TEXT
    },
    {
        id: 'from',
        title: 'От кого',
        type: COLUMN_TYPES.TEXT
    },
    {
        id: 'to',
        title: 'Кому',
        type: COLUMN_TYPES.TEXT
    },
    {
        id: 'date',
        title: 'Дата',
        type: COLUMN_TYPES.DATE
    }
];

export const listOutMailsFx = createEffect<
    { page?: number; after?: string },
    { ids: string[]; cursor?: string; itemsById: Record<string, Mail> }
>(mailingService.listOutMails);

export interface Entity { }

export interface Mail extends Entity {
    id: string;
    subject: string;
    from: string;
    date: string; // ISO
    // ...
}

export const openMailDetail = createEvent<{ id: string }>();
export const listRequest = createEvent<{ page?: number; after?: string }>();
export const sendMailEvent = createEvent<{ mail: any }>();

sample({ clock: listRequest, target: listOutMailsFx });

const OutgoingMailsWidget: Widget<typeof TableView> = {
    view: TableView,
    placement: (ctx) => "center",
    config: { columns: outgoingColumns },
    mount: ({ page, after }) => listRequest({ page, after }),
    commands: {
        // Типы автоматически подтягиваются из TableView.CommandsConfig
        rowClick: ({ id }) => openMailDetail({ id }),
        loadPage: ({ page, after }) => listRequest({ page, after })
    }
};

const SendMailFormWidget: Widget<typeof MailForm> = {
    view: MailForm,
    placement: (ctx) => "right",
    mount: () => {
        present(MailForm);
    },
    commands: { sendMail: sendMailEvent }
};

const GetOutgoingMailsAction: Action = {
    id: "outgoing_mails.get",
    description: "Получить список исходящих писем",
    invoke: ({ page, after }) => listRequest({ page, after }),
    entity:  "out_mail"
};

const ShowOutgoingMailsAction: Action = {
    id: "outgoing_mails.show",
    description: "Показать список исходящих писем",
    invoke: () => {
        present(OutgoingMailsWidget);
    },
    entity: "out_mail"
};

const SendMailFormAction: Action = {
    id: "outgoing_mails.send_form",
    description: "Открыть форму отправки письма",
    invoke: () => {
        present(SendMailFormWidget);
    }
};

const SendMailAction: Action = {
    id: "outgoing_mails.send_mail",
    description: "Отправить письмо",
    invoke: (mail) => {
        sendMailEvent(mail);
    }
};

export {
    OutgoingMailsWidget,
    SendMailFormWidget,
}
export default [GetOutgoingMailsAction, ShowOutgoingMailsAction, SendMailFormAction, SendMailAction];