import { createAnalyticsServiceClient } from "g-analytics/browser";
import { createFrontNrpcClientConfig } from "signal-channel";

export default createAnalyticsServiceClient(createFrontNrpcClientConfig());
