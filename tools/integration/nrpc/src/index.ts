import { createHttpBackend } from './runtime/http-backend';
import { generateServiceToken } from './runtime/service-token';
import { createHttpClient } from './runtime/http-client';
import { Access, resolveMethodAccess } from './decorator/access.decorator';
import type { AccessLevel } from './decorator/access.decorator';
import {
  AccessMatcher,
  canCallMethod,
  parsePermission,
  serializePermission,
  deserializePermissions,
  serializePermissions,
  buildPermissionIndex,
  resolveAccessForMethod,
  extractPermissionsFromPayload,
} from './runtime/access-control';
import type {
  AccessMode,
  PermissionEntry,
  PermissionIndex,
} from './runtime/access-control';
import type { ServiceMetadata } from './types';
import type { AccessControlConfig } from './runtime/http-backend';

export {
  createHttpBackend,
  createHttpClient,
  generateServiceToken,
  Access,
  resolveMethodAccess,
  AccessMatcher,
  canCallMethod,
  parsePermission,
  serializePermission,
  deserializePermissions,
  serializePermissions,
  buildPermissionIndex,
  resolveAccessForMethod,
  extractPermissionsFromPayload,
};

export type { AccessMode, PermissionEntry, PermissionIndex };
export type { AccessLevel };
export type { ServiceMetadata };
export type { AccessControlConfig };
