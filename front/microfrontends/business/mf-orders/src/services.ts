import { createOrdersServiceClient } from "g-orders";
import { createRequestsServiceClient } from "g-requests";

export const ordersClient = createOrdersServiceClient();
export const requestsClient = createRequestsServiceClient();
