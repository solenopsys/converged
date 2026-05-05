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
export {
	createHttpClient,
	type ClientConfig,
} from "./runtime/http-client";
export type { ServiceMetadata } from "./types";
