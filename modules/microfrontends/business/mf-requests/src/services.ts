import { createRequestsServiceClient } from "g-requests";
import { createFrontNrpcClientConfig } from "signal-channel";

export const requestsClient = createRequestsServiceClient(createFrontNrpcClientConfig());
