// The gateway is an orchestrator like the auth one: it calls the cluster over
// Fujin/ZMQ with SERVICE_TOKEN. Direct path, not the "back-core" barrel — the
// barrel re-exports ./stores and would drag the native storage transport into
// this UI-side bundle.
import { createServerNrpcClientConfig } from "back-core/fujin-services";
import { createBusServiceClient } from "g-bus";
import { createWebhooksServiceClient } from "g-webhooks";

export function webhooksClient() {
	return createWebhooksServiceClient(createServerNrpcClientConfig());
}

export function busClient() {
	return createBusServiceClient(createServerNrpcClientConfig());
}
