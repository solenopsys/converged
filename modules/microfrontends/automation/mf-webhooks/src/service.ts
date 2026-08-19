import { createFrontNrpcClientConfig } from "signal-channel";
import { createWebhooksServiceClient } from "g-webhooks";

export default createWebhooksServiceClient(createFrontNrpcClientConfig());
