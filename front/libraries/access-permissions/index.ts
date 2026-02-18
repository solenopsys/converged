import type { ServiceMetadata } from "nrpc";
import type { AccessMode, PermissionEntry, PermissionIndex } from "nrpc";
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
} from "nrpc";

export type { AccessMode, PermissionEntry, PermissionIndex };

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
};

export function canCall(
  permissions: string[],
  metadata: ServiceMetadata,
  methodName: string,
  access?: AccessMode,
): boolean {
  return canCallMethod(permissions, metadata, methodName, access);
}
