import { MailStatsChart } from "src/components/MailStatChart";
import mailingService from "../service";
import { StatCard, Action, Widget  } from "converged-core";
import { createEffect, createEvent } from "effector";

// Events and Effects
export const getDailyStatisticFx = createEffect(mailingService.getDailyStatistic);
export const getStatisticFx = createEffect(mailingService.getStatistic);
export const showDailyStatsRequest = createEvent();

``

// Widgets
const DailyMailsStatisticWidget: Widget<typeof MailStatsChart> = {
    view: MailStatsChart,
    placement: (ctx) => ["float", "dashboard"],
    mount: () => {
        getDailyStatisticFx();
    },
    commands: {
        refresh: () => getDailyStatisticFx()
    }
};

const IncomingMailsStatWidget: Widget<typeof StatCard> = {
    view: StatCard,
    placement: (ctx) => ["float"],
    mount: () => {
        getStatisticFx();
    },
    commands: {
        refresh: () => getStatisticFx()[0]
    }
};

const IncomingWarmStatWidget: Widget<typeof StatCard> = {
    view: StatCard,
    placement: (ctx) => ["float"],
    mount: () => {
        getStatisticFx();
    },
    commands: {
        refresh: () => getStatisticFx()[1]
    }
};

// Actions
const GetDailyMailsStatisticAction: Action = {
    id: "daily_mails.get_statistic",
    description: "История отправок писем",
    invoke: () => getDailyStatisticFx()
};

const ShowDailyMailsStatisticAction: Action = {
    id: "daily_mails.show_statistic",
    description: "Показать историю отправок писем",
    invoke: () => {
        present(DailyMailsStatisticWidget);
    }
};

const GetIncomingMailsStatisticAction: Action = {
    id: "incoming_mails.get_statistic",
    description: "Получить статистику входящих писем",
    invoke: () => getStatisticFx()
};

const ShowIncomingMailsStatisticAction: Action = {
    id: "incoming_mails.show_statistic",
    description: "Показать статистику входящих писем",
    invoke: () => {
        present(IncomingMailsStatWidget);
    }
};

const GetIncomingWarmStatisticAction: Action = {
    id: "incoming_warm.get_statistic",
    description: "Получить статистику прогревочных писем",
    invoke: () => getStatisticFx()
};

const ShowIncomingWarmStatisticAction: Action = {
    id: "incoming_warm.show_statistic",
    description: "Показать статистику прогревочных писем",
    invoke: () => {
        present(IncomingWarmStatWidget);
    }
};

export {
    DailyMailsStatisticWidget,
    IncomingMailsStatWidget,
    IncomingWarmStatWidget,

    GetDailyMailsStatisticAction,
    ShowDailyMailsStatisticAction,
    GetIncomingMailsStatisticAction,
    ShowIncomingMailsStatisticAction,
    GetIncomingWarmStatisticAction,
    ShowIncomingWarmStatisticAction
}
export default [
    GetDailyMailsStatisticAction,
    ShowDailyMailsStatisticAction,
    GetIncomingMailsStatisticAction,
    ShowIncomingMailsStatisticAction,
    GetIncomingWarmStatisticAction,
    ShowIncomingWarmStatisticAction
];