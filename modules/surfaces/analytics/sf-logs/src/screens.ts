import { defineScreens } from "front-core";
import { $screen, type LogsScreen } from "./domain-logs";
import { LogsStatsView } from "./views/LogsStatsView";
import { LogsView } from "./views/LogsView";

const isLogList = (screen: LogsScreen): screen is "hot" | "cold" =>
	screen === "hot" || screen === "cold";

export const SCREENS = defineScreens([
	{
		id: "logs.list",
		when: $screen,
		is: isLogList,
		view: LogsView,
		title: (screen) => (screen === "hot" ? "Hot logs" : "Cold logs"),
		props: (screen) => ({ mode: screen }),
	},
	{
		id: "logs.statistics",
		when: $screen,
		is: "statistics",
		view: LogsStatsView,
		title: "Log statistics",
	},
]);
