// The UI gateway is the only orchestrator: it calls each cluster service
// directly over Fujin/ZMQ with SERVICE_TOKEN. Microservices never call peers.
// Direct path, not the "back-core" barrel: the barrel re-exports ./stores and
// would drag the native storage transport into this UI-side bundle.
import { createServerNrpcClientConfig } from "back-core/fujin-services";
import { createAccessServiceClient } from "g-access";
import { createAuthServiceClient } from "g-auth";
import { createIdentityServiceClient } from "g-identity";
import { createNotifyServiceClient } from "g-notify";
import { createOAuthServiceClient } from "g-oauth";
import { createSesServiceClient } from "g-ses";
import { createSmtpServiceClient } from "g-smtp";
import { createStructServiceClient } from "g-struct";

export function authClient() {
	return createAuthServiceClient(createServerNrpcClientConfig());
}

export function accessClient() {
	return createAccessServiceClient(createServerNrpcClientConfig());
}

export function identityClient() {
	return createIdentityServiceClient(createServerNrpcClientConfig());
}

export function notifyClient() {
	return createNotifyServiceClient(createServerNrpcClientConfig());
}

export function oauthClient() {
	return createOAuthServiceClient(createServerNrpcClientConfig());
}

export function sesClient() {
	return createSesServiceClient(createServerNrpcClientConfig());
}

export function smtpClient() {
	return createSmtpServiceClient(createServerNrpcClientConfig());
}

export function structClient() {
	return createStructServiceClient(createServerNrpcClientConfig());
}
