import { createWebhooksServiceClient } from "g-webhooks";
import { createFrontNrpcClientConfig } from "signal-channel";

export default createWebhooksServiceClient(createFrontNrpcClientConfig());
