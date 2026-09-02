import { createCentimanusServiceClient } from "g-centimanus";
import { createRequestsServiceClient } from "g-requests";
import { createFrontNrpcClientConfig } from "signal-channel";

export const requestsClient = createRequestsServiceClient(
	createFrontNrpcClientConfig(),
);

/** The workflow VM. Creating a request is the only decision the assistant
 * makes; the analysis that follows is business logic and runs as a workflow.
 *
 * Its peer comes from the generated client — centimanus declares it. The
 * deadline does not: this call converts and slices every model on the request,
 * which is minutes, and 20 seconds is the default for an ordinary call. */
export const workflowClient = createCentimanusServiceClient(
	createFrontNrpcClientConfig({ deadlineMs: 300_000 }),
);
