import { createOrdersServiceClient } from "g-orders";
import { createReviewsServiceClient } from "g-reviews";
import { createFrontNrpcClientConfig } from "signal-channel";

export const reviewsClient = createReviewsServiceClient(
	createFrontNrpcClientConfig(),
);

/** A review names the order it is about; the order itself is owned elsewhere,
 * so the card reads it straight from its own service rather than asking
 * rp-reviews to know what an order is. */
export const ordersClient = createOrdersServiceClient(
	createFrontNrpcClientConfig(),
);
