export type { AccessLevel, LLMOptions } from "./decorator/access.decorator";
export {
	Access,
	LLM,
	resolveMethodAccess,
	resolveMethodLLM,
	resolveServiceName,
	Service,
} from "./decorator/access.decorator";

export type {
	AccessMode,
	GrantMethods,
	GrantTree,
	PermissionEntry,
	PermissionIndex,
} from "./runtime/access-control";
export {
	AccessMatcher,
	buildPermissionIndex,
	canCallMethod,
	countGrants,
	extractPermissionsFromPayload,
	grantPermission,
	mergeGrantTrees,
	parsePermission,
	resolveAccessForMethod,
	revokePermission,
	serializePermission,
	toGrantTree,
	toPermissionEntries,
} from "./runtime/access-control";
export {
	ACCESS_TAG_KIND,
	getCurrentAccessTags,
	isServiceActor,
	PERSONAL_TAG_PREFIX,
	personalTag,
	tagsFromGrantTree,
} from "./runtime/access-tags";
export type { NrpcClientEnv } from "./runtime/client-env";
export { configureNrpcClientEnv } from "./runtime/client-env";
export type { CrullerTransportClientConfig } from "./runtime/cruller-transport-client";
export { createCrullerTransportClient } from "./runtime/cruller-transport-client";
export type {
	AccessControlConfig,
	HttpBackendConfig,
	PluginOptions,
} from "./runtime/http-backend";
export { createHttpBackend } from "./runtime/http-backend";
export type { ClientConfig } from "./runtime/http-client";
export { createHttpClient } from "./runtime/http-client";
export type {
	MessagingAccessConfig,
	MessagingAccessMode,
	TrustedMessagingContext,
} from "./runtime/messaging-access";
export {
	MessagingAccessGuard,
	MessagingAuthorizationError,
} from "./runtime/messaging-access";
export type { MessagingBackendConfig } from "./runtime/messaging-backend";
export {
	createMessagingBackend,
	MessagingBackend,
} from "./runtime/messaging-backend";
export type {
	MessagingClientConfig,
	WebSocketChannelController,
	WebSocketClientConfig,
	WebSocketMessageKind,
	WebSocketRequestMessage,
	WebSocketResponseMessage,
} from "./runtime/messaging-client";
export {
	createMessagingClient,
	createWebSocketClient,
} from "./runtime/messaging-client";
export type {
	MessagingRequest,
	MessagingRuntimeConfig,
	MessagingServiceDescriptor,
} from "./runtime/messaging-runtime";
export { NrpcMessagingRuntime } from "./runtime/messaging-runtime";
export { createRtClient } from "./runtime/rt-client";
export { generateServiceToken } from "./runtime/service-token";
export {
	enterWorkspaceContext,
	runWithWorkspaceContext,
} from "./runtime/workspace-context";
export type { WorkspaceContext } from "./runtime/workspace-context-registry";
export {
	getCurrentWorkspace,
	getCurrentWorkspaceContext,
	setWorkspaceContextResolver,
} from "./runtime/workspace-context-registry";
export type { ZmqClientConfig } from "./runtime/zmq-client";
export { createZmqClient } from "./runtime/zmq-client";
export type { ServiceMetadata } from "./types";
