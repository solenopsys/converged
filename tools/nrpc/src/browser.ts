// Browser entrypoint. Keep native messaging and Bun FFI out of frontend bundles.
export type {
  WebSocketChannelController,
  WebSocketClientConfig,
  WebSocketMessageKind,
  WebSocketRequestMessage,
  WebSocketResponseMessage,
} from "./runtime/messaging-client";
export { createWebSocketClient } from "./runtime/messaging-client";
export type { AccessMode, PermissionEntry, PermissionIndex } from "./runtime/access-control";
export { AccessMatcher, parsePermission } from "./runtime/access-control";
export type { ServiceMetadata } from "./types";
