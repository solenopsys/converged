import type { AccessLevel } from "./decorator/access.decorator";
import { Access, resolveMethodAccess } from "./decorator/access.decorator";
import type {
	AccessMode,
	PermissionEntry,
	PermissionIndex,
} from "./runtime/access-control";
import {
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
import type { AccessControlConfig } from "./runtime/http-backend";
import { createHttpBackend } from "./runtime/http-backend";
import { createHttpClient } from "./runtime/http-client";
import { generateServiceToken } from "./runtime/service-token";
import type { WorkspaceContext } from "./runtime/workspace-context";
import {
	getCurrentWorkspace,
	getCurrentWorkspaceContext,
	NRPC_SCOPE_HEADER,
	NRPC_SCOPE_HEADER_ALT,
	NRPC_STORAGE_SCOPE_HEADER,
	NRPC_STORAGE_SCOPE_HEADER_ALT,
	NRPC_WORKSPACE_HEADER,
	NRPC_WORKSPACE_HEADER_ALT,
	resolveScopeFromHeaders,
	resolveWorkspaceFromHeaders,
	runWithWorkspaceContext,
} from "./runtime/workspace-context";
import type { ServiceMetadata } from "./types";

export type {
	AccessControlConfig,
	AccessLevel,
	AccessMode,
	PermissionEntry,
	PermissionIndex,
	ServiceMetadata,
	WorkspaceContext,
};
export {
	Access,
	AccessMatcher,
	buildPermissionIndex,
	canCallMethod,
	createHttpBackend,
	createHttpClient,
	deserializePermissions,
	extractPermissionsFromPayload,
	generateServiceToken,
	getCurrentWorkspace,
	getCurrentWorkspaceContext,
	NRPC_SCOPE_HEADER,
	NRPC_SCOPE_HEADER_ALT,
	NRPC_STORAGE_SCOPE_HEADER,
	NRPC_STORAGE_SCOPE_HEADER_ALT,
	NRPC_WORKSPACE_HEADER,
	NRPC_WORKSPACE_HEADER_ALT,
	parsePermission,
	resolveAccessForMethod,
	resolveMethodAccess,
	resolveScopeFromHeaders,
	resolveWorkspaceFromHeaders,
	runWithWorkspaceContext,
	serializePermission,
	serializePermissions,
};
