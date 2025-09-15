import { TableView } from "converged-core";
import MailDetail from "../components/MailDetail";
import mailingService from "../service";
import { COLUMN_TYPES, Widget, Action, present  } from 'converged-core';
import { createEffect, createEvent } from "effector";

// Интерфейсы
export type MailingStatistic = {
    warmedMailCount: number;
    mailCount: number;
    date: string;
}

export interface PaginationParams {
    offset: number;
    limit: number;
}

export interface PaginatedResult<T> {
    items: T[];
    totalCount?: number;
}

export interface Mail {
    id: string;
    subject: string;
    sender: string;
    recipient: string;
    date: string;
}

export interface OutMail {
    id: string;
    subject: string;
    from: string;
    to: string;
    date: string;
}

export interface Credential {
    id: string;
    username: string;
    email: string;
    password: string;
    group_name: string;
    fio: string;
}

export interface MailingService {
    getStatistic(): Promise<MailingStatistic>
    getDailyStatistic(): Promise<MailingStatistic[]>
    listInMails(params: PaginationParams): Promise<PaginatedResult<Mail>>
    listWarmMails(params: PaginationParams): Promise<PaginatedResult<Mail>>
    listOutMails(params: PaginationParams): Promise<PaginatedResult<OutMail>>
    listCredentials(params: PaginationParams): Promise<PaginatedResult<Credential>>
    getMail(id: string): Promise<object>
}

// Effects
export const listInMailsFx = createEffect<
    PaginationParams,
    PaginatedResult<Mail>
>(mailingService.listInMails);

export const listWarmMailsFx = createEffect<
    PaginationParams,
    PaginatedResult<Mail>
>(mailingService.listWarmMails);

export const getMailFx = createEffect<
    string,
    object
>(mailingService.getMail);

export const openMailDetail = createEvent<{ mailid: string }>();

// Table columns configuration
const incomingColumns = [
    {
        id: 'subject',
        title: 'Тема',
        type: COLUMN_TYPES.TEXT
    },
    {
        id: 'sender',
        title: 'От кого',
        type: COLUMN_TYPES.TEXT
    },
    {
        id: 'recipient',
        title: 'Кому',
        type: COLUMN_TYPES.TEXT
    },
    {
        id: 'date',
        title: 'Дата',
        type: COLUMN_TYPES.DATE
    }
];

// Wrapper функции для использования в TableView
const inMailDataFunction = async (params: PaginationParams) => {
    return await mailingService.listInMails(params);
};

const warmMailDataFunction = async (params: PaginationParams) => {
    return await mailingService.listWarmMails(params);
};

// Widgets
const IncomingMailsWidget: Widget<typeof TableView> = {
    view: TableView,
    placement: (ctx) => "center",
    config: {
        columns: incomingColumns,
        title: "Входящие письма",
        dataFunction: inMailDataFunction,
        basePath: "/incoming",
        detailPath: "/mailing/incoming",
        defaultPageSize: 20,
        pageSizeOptions: [10, 20, 50, 100]
    },
    mount: () => {
         
    },
    commands: {
        refresh: () => {
            // TableView будет обновлять данные автоматически при изменении параметров
        }
    }
};

const WarmMailsWidget: Widget<typeof TableView> = {
    view: TableView,
    placement: (ctx) => "center",
    config: {
        columns: incomingColumns,
        title: "Прогревочные письма",
        dataFunction: warmMailDataFunction,
        basePath: "/warm",
        detailPath: "/mailing/warm",
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

const MailDetailWidget: Widget<typeof MailDetail> = {
    view: MailDetail,
    placement: (ctx) => "right",
    mount: ({ mailid }) => {
        if (mailid) {
            getMailFx(mailid);
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
};

// Actions
const GetIncomingMailsAction: Action = {
    id: "incoming_mails.get",
    description: "Получить список входящих писем",
    invoke: async ({ offset = 0, limit = 20 }) => {
        return await mailingService.listInMails({ offset, limit });
    }
};

const ShowIncomingMailsAction: Action = {
    id: "incoming_mails.show",
    description: "Просмотреть список входящих писем",
    invoke: () => {
        present(IncomingMailsWidget,IncomingMailsWidget.placement({}));
    }
};

const GetWarmMailsAction: Action = {
    id: "warm_mails.get",
    description: "Получить список прогревочных писем",
    invoke: async ({ offset = 0, limit = 20 }) => {
        return await mailingService.listWarmMails({ offset, limit });
    }
};

const ShowWarmMailsAction: Action = {
    id: "warm_mails.show",
    description: "Просмотреть список прогревочных писем",
    invoke: () => {
        present(WarmMailsWidget,WarmMailsWidget.placement({}));
    }
};

const ShowMailDetailAction: Action = {
    id: "mail_detail.show",
    description: "Просмотр письма",
    invoke: ({ mailid }) => {
        openMailDetail({ mailid });
        present(MailDetailWidget, MailDetailWidget.placement({}));
    }
};

export {
    IncomingMailsWidget,
    WarmMailsWidget,
    MailDetailWidget,

    GetIncomingMailsAction,
    ShowIncomingMailsAction,
    GetWarmMailsAction,
    ShowWarmMailsAction,
    ShowMailDetailAction
}

export default [
    GetIncomingMailsAction,
    ShowIncomingMailsAction,
    GetWarmMailsAction,
    ShowWarmMailsAction,
    ShowMailDetailAction
];