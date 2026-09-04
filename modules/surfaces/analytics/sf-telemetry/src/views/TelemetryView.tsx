import { createDomain } from "effector";
import { createInfiniteTableStore, EntityListView } from "front-core";
import type { SetRef } from "front-core/object-runtime";
import type { TelemetryQueryParams } from "g-telemetry";
import { useMemo } from "preact/hooks";
import { telemetryColumns } from "../functions/columns";
import telemetry from "../service";

export type TelemetryMode = "hot" | "cold";

export const TelemetryView = ({
	mode = "hot",
	reference,
}: {
	mode?: TelemetryMode;
	reference?: SetRef;
}) => {
	const store = useMemo(() => {
		const domain = createDomain(`telemetry-${mode}-${crypto.randomUUID()}`);
		return createInfiniteTableStore(domain, (params) =>
			mode === "hot"
				? telemetry.listHot(params as TelemetryQueryParams)
				: telemetry.listCold(params as TelemetryQueryParams),
		);
	}, [mode]);
	const filter =
		reference?.kind === "set" && reference.selection.kind === "query"
			? reference.selection.filter
			: undefined;

	return (
		<EntityListView
			tableId={`telemetry-${mode}`}
			title={mode === "hot" ? "Telemetry (Hot)" : "Telemetry (Cold)"}
			store={store}
			columns={telemetryColumns}
			baseFilters={filter ? { filter } : undefined}
		/>
	);
};
