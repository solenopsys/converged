import { CreateAction, CreateWidget } from "front-core";
import { LogsView } from "./views/LogsView";
import { LogsStatsView } from "./views/LogsStatsView";

const SHOW_LOGS_HOT = "logs.hot.show";
const SHOW_LOGS_COLD = "logs.cold.show";
const SHOW_LOGS_STATS = "logs.stats.show";

const createLogsHotWidget: CreateWidget<typeof LogsView> = () => ({
  view: LogsView,
  placement: () => "center",
  config: { mode: "hot" },
});

const createLogsColdWidget: CreateWidget<typeof LogsView> = () => ({
  view: LogsView,
  placement: () => "center",
  config: { mode: "cold" },
});

const createLogsStatsWidget: CreateWidget<typeof LogsStatsView> = (bus) => ({
  view: LogsStatsView,
  placement: () => "center",
  config: { bus },
});

const createShowLogsHotAction: CreateAction<any> = (bus) => ({
  id: SHOW_LOGS_HOT,
  description: "Show hot logs",
  invoke: () => {
    bus.present({ widget: createLogsHotWidget(bus) });
  },
});

const createShowLogsColdAction: CreateAction<any> = (bus) => ({
  id: SHOW_LOGS_COLD,
  description: "Show cold logs",
  invoke: () => {
    bus.present({ widget: createLogsColdWidget(bus) });
  },
});

const createShowLogsStatsAction: CreateAction<any> = (bus) => ({
  id: SHOW_LOGS_STATS,
  description: "Show logs statistics",
  invoke: () => {
    bus.present({ widget: createLogsStatsWidget(bus) });
  },
});

const ACTIONS = [createShowLogsHotAction, createShowLogsColdAction, createShowLogsStatsAction];

export { SHOW_LOGS_HOT, SHOW_LOGS_COLD, SHOW_LOGS_STATS, createShowLogsHotAction, createShowLogsColdAction, createShowLogsStatsAction };
export default ACTIONS;
