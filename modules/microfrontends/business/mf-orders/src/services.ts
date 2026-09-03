import { createOrdersServiceClient } from "g-orders";
import { createRequestsServiceClient } from "g-requests";
import { createFrontNrpcClientConfig } from "signal-channel";

export const ordersClient = createOrdersServiceClient(
	createFrontNrpcClientConfig(),
);
export const requestsClient = createRequestsServiceClient(
	createFrontNrpcClientConfig(),
);
