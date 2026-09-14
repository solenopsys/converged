import { services as fileServices } from "files-state";
import { createCentimanusServiceClient } from "g-centimanus";
import { createEquipmentServiceClient } from "g-equipment";
import { createFilesServiceClient } from "g-files";
import { createOrdersServiceClient } from "g-orders";
import { createRequestsServiceClient } from "g-requests";
import { createStoreServiceClient } from "g-store";
import { createFrontNrpcClientConfig } from "signal-channel";

export const ordersClient = createOrdersServiceClient(
	createFrontNrpcClientConfig(),
);
export const requestsClient = createRequestsServiceClient(
	createFrontNrpcClientConfig(),
);

/**
 * Assigning a job to a machine is two writes in two services — the order's
 * `equipmentId` and the machine's schedule slot — and neither repository may
 * call the other. Two calls from here is the allowed second form of integration
 * (§0, rule 1): both are plain writes with nothing to recover between them, so
 * it needs a browser rather than a workflow.
 */
export const equipmentClient = createEquipmentServiceClient(
	createFrontNrpcClientConfig(),
);

/** The workflow VM. Turning a request into an order touches three services and
 *  has to survive a restart, so it lives on centimanus and not here. */
export const workflowClient = createCentimanusServiceClient(
	createFrontNrpcClientConfig({ deadlineMs: 120_000 }),
);

export const REQUEST_TO_ORDER_SCRIPT = "workflows/wf-request-to-order.js";

/**
 * The files a job was ordered from.
 *
 * An order does not carry files — the request it came from does, and the two are
 * joined by `requestId`. Reading both from the browser is the allowed second form
 * of integration: two reads, nothing to recover between them.
 */
export const filesClient = createFilesServiceClient(
	createFrontNrpcClientConfig(),
);

/**
 * Whichever surface mounts first hands `files-state` its peers; the rest see it
 * already set. Downloading a drawing from an order card has to work whether or
 * not the Files area was ever opened.
 */
if (typeof window !== "undefined" && !fileServices.getFilesService()) {
	fileServices.setFilesService(filesClient);
	fileServices.setStoreService(
		createStoreServiceClient(createFrontNrpcClientConfig()),
	);
}
