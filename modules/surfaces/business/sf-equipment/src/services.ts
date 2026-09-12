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
