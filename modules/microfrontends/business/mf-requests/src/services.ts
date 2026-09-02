import { createCentimanusServiceClient } from "g-centimanus";
import { createRequestsServiceClient } from "g-requests";
import { createFrontNrpcClientConfig } from "signal-channel";

export const requestsClient = createRequestsServiceClient(
	createFrontNrpcClientConfig(),
);

/** The workflow VM. Creating a request is the only decision the assistant
 * makes; the analysis that follows is business logic and runs as a workflow. */
export const workflowClient = createCentimanusServiceClient(
	createFrontNrpcClientConfig(),
);
