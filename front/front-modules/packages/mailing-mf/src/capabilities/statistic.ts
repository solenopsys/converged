import { MailStatsChart } from "src/components/MailStatChart";
import mailingService from "../service";

const DailyMailsStatisticCap = {
    description: "История отправок писем",
    views: [MailStatsChart],
    show: ["float"], 
    dataSource:  mailingService.getDailyStatistic
}

import { StatCard } from "converged-core";

 




const IncomMailsStatisticCap = {
    description: "Входящих писем",
    views: [StatCard],
    show: ["float"], 
    dataSource:  mailingService.getDailyStatistic,
    dataTransform: (data) => data[0]
}

const IncomWarmStatisticCap = {
    description: "Прогревочных писем",
    views: [StatCard],
    show: ["float"], 
    dataSource:  mailingService.getDailyStatistic,
    dataTransform: (data) => data[1]
}

 

export { DailyMailsStatisticCap, IncomMailsStatisticCap, IncomWarmStatisticCap };