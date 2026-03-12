import { CreateAction, CreateWidget } from "front-core";
import { TelemetryView } from "./views/TelemetryView";
import type { TelemetryMode } from "./domain-telemetry";

const SHOW_TELEMETRY = "telemetry.show";
const SHOW_TELEMETRY_COLD = "telemetry.show.cold";

const createTelemetryWidget: CreateWidget<typeof TelemetryView> = (
  _bus,
  params?: { mode: TelemetryMode },
) => ({
  view: TelemetryView,
  placement: () => "center",
  config: {
    mode: params?.mode ?? "hot",
  },
});

const createShowTelemetryAction: CreateAction<any> = (bus) => ({
  id: SHOW_TELEMETRY,
  description: "Show hot telemetry",
  invoke: () => {
    bus.present({ widget: createTelemetryWidget(bus, { mode: "hot" }) });
  },
});

const createShowTelemetryColdAction: CreateAction<any> = (bus) => ({
  id: SHOW_TELEMETRY_COLD,
  description: "Show cold telemetry",
  invoke: () => {
    bus.present({ widget: createTelemetryWidget(bus, { mode: "cold" }) });
  },
});

const ACTIONS = [createShowTelemetryAction, createShowTelemetryColdAction];

export {
  SHOW_TELEMETRY,
  SHOW_TELEMETRY_COLD,
  createShowTelemetryAction,
  createShowTelemetryColdAction,
};
export default ACTIONS;
