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
	description:
		"Open the live operational log table. Use when the user asks for recent events, " +
		"current errors, warnings, or activity that is still in hot storage.",
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
	description:
		"Open the archived log table. Use for older operational events that are no " +
		"longer in the live log stream.",
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
	description:
		"Open aggregate log counts for hot storage, archived storage, errors, and " +
		"warnings. Use for totals and trends, not for individual log entries.",
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
