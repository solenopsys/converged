import type { CreateAction } from "front-core";
import { logsScreenActivated } from "./domain-logs";

const SHOW_LOGS_HOT = "logs.hot.show";
const SHOW_LOGS_COLD = "logs.cold.show";
const SHOW_LOGS_STATS = "logs.stats.show";

const createShowLogsHotAction: CreateAction = () => ({
	id: SHOW_LOGS_HOT,
	capability: "logs/listHot(r)",
	brief: "Open the live log stream",
	category: "logs",
	llm: {
		microfrontend: "logs-mf",
		brief: "llm.actions.logs_hot_show.brief",
		description: "llm.actions.logs_hot_show.description",
	},
	exposure: "user",
	priority: "normal",
	invoke: () => {
		logsScreenActivated("hot");
		return { ok: true, entity: "logs", mode: "hot" };
	},
});

const createShowLogsColdAction: CreateAction = () => ({
	id: SHOW_LOGS_COLD,
	capability: "logs/listCold(r)",
	brief: "Open archived logs",
	category: "logs",
	llm: {
		microfrontend: "logs-mf",
		brief: "llm.actions.logs_cold_show.brief",
		description: "llm.actions.logs_cold_show.description",
	},
	exposure: "user",
	priority: "normal",
	invoke: () => {
		logsScreenActivated("cold");
		return { ok: true, entity: "logs", mode: "cold" };
	},
});

const createShowLogsStatsAction: CreateAction = () => ({
	id: SHOW_LOGS_STATS,
	capability: "logs/getStatistic(r)",
	brief: "Open log volume statistics",
	category: "logs",
	llm: {
		microfrontend: "logs-mf",
		brief: "llm.actions.logs_stats_show.brief",
		description: "llm.actions.logs_stats_show.description",
	},
	exposure: "user",
	priority: "normal",
	invoke: () => {
		logsScreenActivated("statistics");
		return { ok: true, entity: "logs", mode: "statistics" };
	},
});

const ACTIONS = [
	createShowLogsHotAction,
	createShowLogsColdAction,
	createShowLogsStatsAction,
];

export {
	SHOW_LOGS_HOT,
	SHOW_LOGS_COLD,
	SHOW_LOGS_STATS,
	createShowLogsHotAction,
	createShowLogsColdAction,
	createShowLogsStatsAction,
};
export default ACTIONS;
