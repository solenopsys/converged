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
  description: "Show hot telemetry",
  invoke: () => {
    bus.present({ widget: createTelemetryHotWidget(bus) });
  },
});

const createShowTelemetryColdAction: CreateAction<any> = (bus) => ({
  id: SHOW_TELEMETRY_COLD,
  description: "Show cold telemetry",
  invoke: () => {
    bus.present({ widget: createTelemetryColdWidget(bus) });
  },
});

const createShowTelemetryStatsAction: CreateAction<any> = (bus) => ({
  id: SHOW_TELEMETRY_STATS,
  description: "Show telemetry statistics",
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
