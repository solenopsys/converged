import type { CreateAction } from "front-core";
import { presentReference, setRef } from "front-core/object-runtime";

const SHOW_LOGS_HOT = "logs.hot.show";
const SHOW_LOGS_COLD = "logs.cold.show";
const SHOW_LOGS_STATS = "logs.stats.show";

const createShowLogsHotAction: CreateAction = () => ({
	id: SHOW_LOGS_HOT,
	capability: "logs/listHot(r)",
	invoke: () => {
		void presentReference(
			setRef("logs.entry", {
				kind: "query",
				presets: [{ id: "logs.hot" }],
			}),
		);
		return { ok: true, entity: "logs", mode: "hot" };
	},
});

const createShowLogsColdAction: CreateAction = () => ({
	id: SHOW_LOGS_COLD,
	capability: "logs/listCold(r)",
	invoke: () => {
		void presentReference(
			setRef("logs.entry", {
				kind: "query",
				presets: [{ id: "logs.cold" }],
			}),
		);
		return { ok: true, entity: "logs", mode: "cold" };
	},
});

const createShowLogsStatsAction: CreateAction = () => ({
	id: SHOW_LOGS_STATS,
	capability: "logs/getStatistic(r)",
	invoke: () => {
		void presentReference(setRef("logs.statistic", { kind: "query" }));
		return { ok: true, entity: "logs", mode: "statistics" };
	},
});

const ACTIONS = [
	createShowLogsHotAction,
	createShowLogsColdAction,
	createShowLogsStatsAction,
];

export {
	createShowLogsColdAction,
	createShowLogsHotAction,
	createShowLogsStatsAction,
	SHOW_LOGS_COLD,
	SHOW_LOGS_HOT,
	SHOW_LOGS_STATS,
};
export default ACTIONS;
