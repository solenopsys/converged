import MailForm from "src/components/MailForm";
import { TableView } from "converged-core";
import mailingService from "../service";
import { COLUMN_TYPES, Widget, Action, present } from 'converged-core';
import { createEvent, createEffect } from "effector";

// Интерфейсы (используем те же что и в inmails.ts)
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

// Effects
export const listOutMailsFx = createEffect<
    PaginationParams,
    PaginatedResult<OutMail>
>(mailingService.listOutMails);

export const sendMailFx = createEffect<
    any,
    void
>(mailingService.sendMail);

// Events
export const openMailDetail = createEvent<{ mailid: string }>();
export const sendMailEvent = createEvent<{ mail: any }>();

// Table columns configuration
const outgoingColumns = [
    {
        id: 'subject',
        title: 'Тема',
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

// Wrapper функция для использования в TableView
const outMailDataFunction = async (params: PaginationParams) => {
    return await mailingService.listOutMails(params);
};

// Widgets
const OutgoingMailsWidget: Widget<typeof TableView> = {
    view: TableView,
    placement: (ctx) => "center",
    config: {
        columns: outgoingColumns,
        title: "Исходящие письма",
        dataFunction: outMailDataFunction,
        basePath: "/outgoing",
        detailPath: "/mailing/outgoing",
        defaultPageSize: 20,
        pageSizeOptions: [10, 20, 50, 100]
    },
    mount: () => {
        // TableView сам управляет загрузкой данных через dataFunction
    },
    commands: {
        refresh: () => {
            // TableView будет обновлять данные автоматически при изменении параметров
        }
    }
};

const SendMailFormWidget: Widget<typeof MailForm> = {
    view: MailForm,
    placement: (ctx) =>"center", //todo "right",
    mount: () => {
        // Инициализация формы
    },
    commands: {
        sendMail: (mail) => {
            sendMailFx(mail);
        },
        close: () => {
            // Handle close action
        }
    }
};

// Actions
const GetOutgoingMailsAction: Action = {
    id: "outgoing_mails.get",
    description: "Получить список исходящих писем",
    invoke: async ({ offset = 0, limit = 20 }) => {
        return await mailingService.listOutMails({ offset, limit });
    }
};

const ShowOutgoingMailsAction: Action = {
    id: "outgoing_mails.show",
    description: "Показать список исходящих писем",
    invoke: () => {
        present(OutgoingMailsWidget, OutgoingMailsWidget.placement({}));
    }
};

const ShowSendMailFormAction: Action = {
    id: "outgoing_mails.send_form",
    description: "Открыть форму отправки письма",
    invoke: () => {
        present(SendMailFormWidget, SendMailFormWidget.placement({}));
    }
};

const SendMailAction: Action = {
    id: "outgoing_mails.send_mail",
    description: "Отправить письмо",
    invoke: (mail) => {
        sendMailFx(mail);
    }
};

export {
    OutgoingMailsWidget,
    SendMailFormWidget,

    GetOutgoingMailsAction,
    ShowOutgoingMailsAction,
    ShowSendMailFormAction,
    SendMailAction
};

export default [
    GetOutgoingMailsAction,
    ShowOutgoingMailsAction,
    ShowSendMailFormAction,
    SendMailAction
];