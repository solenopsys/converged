import { CreateAction, CreateWidget } from "front-core";
import { LogsView } from "./views/LogsView";
import { LogsStatsView } from "./views/LogsStatsView";
import type { LogsMode } from "./domain-logs";

const SHOW_LOGS = "logs.show";
const SHOW_LOGS_COLD = "logs.show.cold";
const SHOW_LOGS_STATS = "logs.stats.show";

const createLogsWidget: CreateWidget<typeof LogsView> = (
  _bus,
  params?: { mode: LogsMode },
) => ({
  view: LogsView,
  placement: () => "center",
  config: {
    mode: params?.mode ?? "hot",
  },
});

const createLogsStatsWidget: CreateWidget<typeof LogsStatsView> = (bus) => ({
  view: LogsStatsView,
  placement: () => "center",
  config: { bus },
});

const createShowLogsAction: CreateAction<any> = (bus) => ({
  id: SHOW_LOGS,
  description: "Show hot logs",
  invoke: () => {
    bus.present({ widget: createLogsWidget(bus, { mode: "hot" }) });
  },
});

const createShowLogsColdAction: CreateAction<any> = (bus) => ({
  id: SHOW_LOGS_COLD,
  description: "Show cold logs",
  invoke: () => {
    bus.present({ widget: createLogsWidget(bus, { mode: "cold" }) });
  },
});

const createShowLogsStatsAction: CreateAction<any> = (bus) => ({
  id: SHOW_LOGS_STATS,
  description: "Show logs statistics",
  invoke: () => {
    bus.present({ widget: createLogsStatsWidget(bus) });
  },
});

const ACTIONS = [createShowLogsAction, createShowLogsColdAction, createShowLogsStatsAction];

export { SHOW_LOGS, SHOW_LOGS_COLD, SHOW_LOGS_STATS, createShowLogsAction, createShowLogsColdAction, createShowLogsStatsAction };
export default ACTIONS;
