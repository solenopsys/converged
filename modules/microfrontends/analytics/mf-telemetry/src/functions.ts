import { CreateAction, CreateWidget } from "front-core";
import { TelemetryView } from "./views/TelemetryView";
import { TelemetryStatsView } from "./views/TelemetryStatsView";

const SHOW_TELEMETRY_HOT = "telemetry.hot.show";
const SHOW_TELEMETRY_COLD = "telemetry.cold.show";
const SHOW_TELEMETRY_STATS = "telemetry.stats.show";

const createTelemetryHotWidget: CreateWidget<typeof TelemetryView> = () => ({
  view: TelemetryView,
  placement: () => "center",
  config: { mode: "hot" },
});

const createTelemetryColdWidget: CreateWidget<typeof TelemetryView> = () => ({
  view: TelemetryView,
  placement: () => "center",
  config: { mode: "cold" },
});

const createTelemetryStatsWidget: CreateWidget<typeof TelemetryStatsView> = (bus) => ({
  view: TelemetryStatsView,
  placement: () => "center",
  config: { bus },
});

const createShowTelemetryHotAction: CreateAction<any> = (bus) => ({
  id: SHOW_TELEMETRY_HOT,
  llm: {
    microfrontend: "telemetry-mf",
    brief: "llm.actions.telemetry_hot_show.brief",
    description: "llm.actions.telemetry_hot_show.description",
  },
  exposure: "user",
  priority: "normal",
  invoke: () => {
    bus.present({ widget: createTelemetryHotWidget(bus) });
  },
});

const createShowTelemetryColdAction: CreateAction<any> = (bus) => ({
  id: SHOW_TELEMETRY_COLD,
  llm: {
    microfrontend: "telemetry-mf",
    brief: "llm.actions.telemetry_cold_show.brief",
    description: "llm.actions.telemetry_cold_show.description",
  },
  exposure: "user",
  priority: "normal",
  invoke: () => {
    bus.present({ widget: createTelemetryColdWidget(bus) });
  },
});

const createShowTelemetryStatsAction: CreateAction<any> = (bus) => ({
  id: SHOW_TELEMETRY_STATS,
  llm: {
    microfrontend: "telemetry-mf",
    brief: "llm.actions.telemetry_stats_show.brief",
    description: "llm.actions.telemetry_stats_show.description",
  },
  exposure: "user",
  priority: "normal",
  invoke: () => {
    bus.present({ widget: createTelemetryStatsWidget(bus) });
  },
});

const ACTIONS = [createShowTelemetryHotAction, createShowTelemetryColdAction, createShowTelemetryStatsAction];

export {
  SHOW_TELEMETRY_HOT,
  SHOW_TELEMETRY_COLD,
  SHOW_TELEMETRY_STATS,
  createShowTelemetryHotAction,
  createShowTelemetryColdAction,
  createShowTelemetryStatsAction,
};
export default ACTIONS;
