import { MailStatsChart } from "src/components/MailStatChart";
import mailingService from "../service";
import { StatCard, CreateAction, CreateWidget, present } from "converged-core";
import { sample } from "effector";
import domain from "../domain";

const GET_DAILY_MAILS_STATISTIC = "daily_mails.get_statistic";
const SHOW_DAILY_MAILS_STATISTIC = "daily_mails.show_statistic";
const GET_INCOMING_MAILS_STATISTIC = "incoming_mails.get_statistic";
const SHOW_INCOMING_MAILS_STATISTIC = "incoming_mails.show_statistic";
const GET_INCOMING_WARM_STATISTIC = "incoming_warm.get_statistic";
const SHOW_INCOMING_WARM_STATISTIC = "incoming_warm.show_statistic";

// Events and Effects
const getDailyStatisticFx = domain.createEffect<any, any>(mailingService.getDailyStatistic);
const getStatisticFx = domain.createEffect<any, any>(mailingService.getStatistic);
const showDailyStatsRequest = domain.createEvent();
const getIncomingStatsEvent = domain.createEvent();
const getWarmStatsEvent = domain.createEvent();

sample({ clock: showDailyStatsRequest, target: getDailyStatisticFx });
sample({ clock: getIncomingStatsEvent, target: getStatisticFx });
sample({ clock: getWarmStatsEvent, target: getStatisticFx });

const createDailyMailsStatisticWidget: CreateWidget<typeof MailStatsChart> = () => ({
    view: MailStatsChart,
    placement: () => ["float", "dashboard"],
    mount: () => {
        getDailyStatisticFx();
    },
    commands: {
        refresh: () => getDailyStatisticFx()
    }
});

const createIncomingMailsStatWidget: CreateWidget<typeof StatCard> = () => ({
    view: StatCard,
    placement: () => ["float"],
    mount: () => {
        getStatisticFx();
    },
    commands: {
        refresh: () => getStatisticFx()[0]
    }
});

const createIncomingWarmStatWidget: CreateWidget<typeof StatCard> = () => ({
    view: StatCard,
    placement: () => ["float"],
    mount: () => {
        getStatisticFx();
    },
    commands: {
        refresh: () => getStatisticFx()[1]
    }
});

const createGetDailyMailsStatisticAction: CreateAction<any> = () => ({
    id: GET_DAILY_MAILS_STATISTIC,
    description: "Get daily mails statistic",
    invoke: () => getDailyStatisticFx()
});

const createShowDailyMailsStatisticAction: CreateAction<any> = (bus) => ({
    id: SHOW_DAILY_MAILS_STATISTIC,
    description: "Show daily mails statistic",
    invoke: () => {
        bus.present(createDailyMailsStatisticWidget(bus));
    }
});

const createGetIncomingMailsStatisticAction: CreateAction<any> = () => ({
    id: GET_INCOMING_MAILS_STATISTIC,
    description: "Get incoming mails statistic",
    invoke: () => getStatisticFx()
});

const createShowIncomingMailsStatisticAction: CreateAction<any> = (bus) => ({
    id: SHOW_INCOMING_MAILS_STATISTIC,
    description: "Show incoming mails statistic",
    invoke: () => {
        bus.present(createIncomingMailsStatWidget(bus));
    }
});

const createGetIncomingWarmStatisticAction: CreateAction<any> = () => ({
    id: GET_INCOMING_WARM_STATISTIC,
    description: "Get warm mails statistic",
    invoke: () => getStatisticFx()
});

const createShowIncomingWarmStatisticAction: CreateAction<any> = (bus) => ({
    id: SHOW_INCOMING_WARM_STATISTIC,
    description: "Show warm mails statistic",
    invoke: () => {
        bus.present(createIncomingWarmStatWidget(bus));
    }
});

const ACTIONS = [
    createGetDailyMailsStatisticAction,
    createShowDailyMailsStatisticAction,
    createGetIncomingMailsStatisticAction,
    createShowIncomingMailsStatisticAction,
    createGetIncomingWarmStatisticAction,
    createShowIncomingWarmStatisticAction
];

export {
    GET_DAILY_MAILS_STATISTIC,
    SHOW_DAILY_MAILS_STATISTIC,
    GET_INCOMING_MAILS_STATISTIC,
    SHOW_INCOMING_MAILS_STATISTIC,
    GET_INCOMING_WARM_STATISTIC,
    SHOW_INCOMING_WARM_STATISTIC,
    createGetDailyMailsStatisticAction,
    createShowDailyMailsStatisticAction,
    createGetIncomingMailsStatisticAction,
    createShowIncomingMailsStatisticAction,
    createGetIncomingWarmStatisticAction,
    createShowIncomingWarmStatisticAction
};

export default ACTIONS;