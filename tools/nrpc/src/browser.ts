// Browser entrypoint. Keep native messaging and Bun FFI out of frontend bundles.
export type {
  WebSocketChannelController,
  WebSocketClientConfig,
  WebSocketMessageKind,
  WebSocketRequestMessage,
  WebSocketResponseMessage,
} from "./runtime/messaging-client";
export { createWebSocketClient } from "./runtime/messaging-client";
export type { AccessMode, GrantMethods, GrantTree, PermissionEntry, PermissionIndex } from "./runtime/access-control";
export { AccessMatcher, countGrants, grantPermission, mergeGrantTrees, parsePermission, revokePermission, toGrantTree, toPermissionEntries } from "./runtime/access-control";
export type { ServiceMetadata } from "./types";
