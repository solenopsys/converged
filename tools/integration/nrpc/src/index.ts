export type { AccessLevel } from "./decorator/access.decorator";
export { Access, resolveMethodAccess } from "./decorator/access.decorator";

export type {
	AccessMode,
	PermissionEntry,
	PermissionIndex,
} from "./runtime/access-control";
export {
	AccessMatcher,
	buildPermissionIndex,
	canCallMethod,
	deserializePermissions,
	extractPermissionsFromPayload,
	parsePermission,
	resolveAccessForMethod,
	serializePermission,
	serializePermissions,
} from "./runtime/access-control";

export type {
	AccessControlConfig,
	ElysiaBackendConfig,
	PluginOptions,
} from "./runtime/http-backend";
export { createHttpBackend } from "./runtime/http-backend";
export type { NrpcClientEnv } from "./runtime/client-env";
export { configureNrpcClientEnv } from "./runtime/client-env";
export { createHttpClient } from "./runtime/http-client";
export { generateServiceToken } from "./runtime/service-token";
export type { ServiceMetadata } from "./types";
export type { WorkspaceContext } from "./runtime/workspace-context-registry";
export {
	getCurrentWorkspace,
	getCurrentWorkspaceContext,
	setWorkspaceContextResolver,
} from "./runtime/workspace-context-registry";
