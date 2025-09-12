import { TableView } from "converged-core";
import MailDetail from "../components/MailDetail";
import mailingService from "../service";
import { COLUMN_TYPES, Widget, Action,   } from 'converged-core';
import { createEffect, createEvent } from "effector";

// Events and Effects
export const listInMailsFx = createEffect<
    { page?: number; after?: string },
    { ids: string[]; cursor?: string; itemsById: Record<string, any> }
>(mailingService.listInMails);

export const listWarmMailsFx = createEffect<
    { page?: number; after?: string },
    { ids: string[]; cursor?: string; itemsById: Record<string, any> }
>(mailingService.listWarmMails);

export const openMailDetail = createEvent<{ mailid: string }>();
export const listIncomingRequest = createEvent<{ page?: number; after?: string }>();
export const listWarmRequest = createEvent<{ page?: number; after?: string }>();

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

// Widgets
const IncomingMailsWidget: Widget<typeof TableView> = {
    view: TableView,
    placement: (ctx) => "center",
    config: { columns: incomingColumns },
    mount: ({ page, after }) => listIncomingRequest({ page, after }),
    commands: {
        rowClick: ({ id }) => openMailDetail({ mailid: id }),
        loadPage: ({ page, after }) => listIncomingRequest({ page, after })
    }
};

const WarmMailsWidget: Widget<typeof TableView> = {
    view: TableView,
    placement: (ctx) => "center",
    config: { columns: incomingColumns },
    mount: ({ page, after }) => listWarmRequest({ page, after }),
    commands: {
        rowClick: ({ id }) => openMailDetail({ mailid: id }),
        loadPage: ({ page, after }) => listWarmRequest({ page, after })
    }
};

const MailDetailWidget: Widget<typeof MailDetail> = {
    view: MailDetail,
    placement: (ctx) => "right",
    mount: () => {
        // Initialization logic if needed
    },
    commands: {
        response: () => {
            // Handle response action
        }
    }
};

// Actions
const GetIncomingMailsAction: Action = {
    id: "incoming_mails.get",
    description: "Получить список входящих писем",
    invoke: ({ page, after }) => listIncomingRequest({ page, after })
};

const ShowIncomingMailsAction: Action = {
    id: "incoming_mails.show",
    description: "Просмотреть список входящих писем",
    invoke: () => {
        present(IncomingMailsWidget);
    }
};

const GetWarmMailsAction: Action = {
    id: "warm_mails.get",
    description: "Получить список прогревочных писем",
    invoke: ({ page, after }) => listWarmRequest({ page, after })
};

const ShowWarmMailsAction: Action = {
    id: "warm_mails.show",
    description: "Просмотреть список прогревочных писем",
    invoke: () => {
        present(WarmMailsWidget);
    }
};

const ShowMailDetailAction: Action = {
    id: "mail_detail.show",
    description: "Просмотр письма",
    invoke: ({ mailid }) => {
        openMailDetail({ mailid });
        present(MailDetailWidget);
    }
};

// Sample connections
import { sample } from "effector";

sample({ clock: listIncomingRequest, target: listInMailsFx });
sample({ clock: listWarmRequest, target: listWarmMailsFx });

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