import { createCentimanusServiceClient } from "g-centimanus";
import { createEquipmentServiceClient } from "g-equipment";
import { createOrdersServiceClient } from "g-orders";
import { createTelemetryServiceClient } from "g-telemetry";
import { createFrontNrpcClientConfig } from "signal-channel";

export const equipmentClient = createEquipmentServiceClient(
	createFrontNrpcClientConfig(),
);

/** A running machine names the order it is running; the order itself is
 * owned elsewhere, so the card reads it straight from its own service rather
 * than asking rp-equipment to know about orders. */
export const ordersClient = createOrdersServiceClient(
	createFrontNrpcClientConfig(),
);

/** Temperatures and the rest of the live parameters are telemetry rows, not
 * equipment columns: the machine record holds what a machine *is*, the sample
 * stream holds what it is doing right now. */
export const telemetryClient = createTelemetryServiceClient(
	createFrontNrpcClientConfig(),
);

/** The workflow VM. A breakdown touches the machine, its schedule, the orders
 *  on it and everyone's screen — four services — so it is a workflow, not a
 *  sequence of calls from this card. */
export const workflowClient = createCentimanusServiceClient(
	createFrontNrpcClientConfig({ deadlineMs: 120_000 }),
);

export const INCIDENT_SCRIPT = "workflows/wf-equipment-incident.js";

/** What `wf-equipment-incident` answers with; only what the card shows. */
export type IncidentReport = {
	equipmentId: string;
	cancelledSlots: string[];
	blockedOrders: string[];
	atRiskSlots: Array<{ id: string; orderId?: string; startAt: string }>;
	errors: Array<{ stage: string; id?: string; message: string }>;
};

/**
 * Reports a machine as broken.
 *
 * `error` is not an ordinary state write: it releases the running slot and
 * blocks the order on it, and that cascade lives in one place so the operator
 * button, the assistant and — later — the hardware bridge all do the same thing.
 */
export async function reportIncident(
	equipmentId: string,
	details: { description?: string; severity?: string } = {},
): Promise<IncidentReport> {
	const run = await workflowClient.runWorkflow(INCIDENT_SCRIPT, {
		equipmentId,
		...(details.description ? { description: details.description } : {}),
		...(details.severity ? { severity: details.severity } : {}),
	});
	// A refused run is an ordinary outcome — most often the role has no
	// `wf/workflows/wf-equipment-incident.js(x)` grant — and has to be said.
	if (!run.ok) throw new Error(run.error ?? "Incident was not reported");
	return run.result as IncidentReport;
}
