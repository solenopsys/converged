import type { CreateAction, CreateWidget } from "front-core";
import { presentReference, setRef } from "front-core/object-runtime";
import { TelemetryStatsView } from "./views/TelemetryStatsView";

const SHOW_TELEMETRY_HOT = "telemetry.hot.show";
const SHOW_TELEMETRY_COLD = "telemetry.cold.show";
const SHOW_TELEMETRY_STATS = "telemetry.stats.show";

const createTelemetryStatsWidget: CreateWidget<typeof TelemetryStatsView> = (
	bus,
) => ({
	view: TelemetryStatsView,
	placement: () => "center",
	config: { bus },
});

const createShowTelemetryHotAction: CreateAction = () => ({
	id: SHOW_TELEMETRY_HOT,
	invoke: () => {
		void presentReference(
			setRef("telemetry.entry", {
				kind: "query",
				presets: [{ id: "telemetry.hot" }],
			}),
		);
	},
});

const createShowTelemetryColdAction: CreateAction = () => ({
	id: SHOW_TELEMETRY_COLD,
	invoke: () => {
		void presentReference(
			setRef("telemetry.entry", {
				kind: "query",
				presets: [{ id: "telemetry.cold" }],
			}),
		);
	},
});

const createShowTelemetryStatsAction: CreateAction = (bus) => ({
	id: SHOW_TELEMETRY_STATS,
	invoke: () => {
		bus.present({ widget: createTelemetryStatsWidget(bus) });
	},
});

const ACTIONS = [
	createShowTelemetryHotAction,
	createShowTelemetryColdAction,
	createShowTelemetryStatsAction,
];

export {
	createShowTelemetryColdAction,
	createShowTelemetryHotAction,
	createShowTelemetryStatsAction,
	SHOW_TELEMETRY_COLD,
	SHOW_TELEMETRY_HOT,
	SHOW_TELEMETRY_STATS,
};
export default ACTIONS;
