import { createHttpBackend } from './runtime/http-backend';
import { createHttpClient } from './runtime/http-client';
import { Access, SecureType, secure, secureAll } from './decorator/access.decorator';
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
  Access,
  SecureType,
  secure,
  secureAll,
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
export type { ServiceMetadata };
export type { AccessControlConfig };
