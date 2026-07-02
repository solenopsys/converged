import { EntityListView } from "front-core";
import React from "react";
import {
	$telemetryColdStore,
	$telemetryHotStore,
	type TelemetryMode,
} from "../domain-telemetry";
import { telemetryColumns } from "../functions/columns";

export const TelemetryView = ({ mode = "hot" }: { mode?: TelemetryMode }) => (
	<EntityListView
		tableId={`telemetry-${mode}`}
		title={mode === "hot" ? "Telemetry (Hot)" : "Telemetry (Cold)"}
		store={mode === "hot" ? $telemetryHotStore : $telemetryColdStore}
		columns={telemetryColumns}
	/>
);
