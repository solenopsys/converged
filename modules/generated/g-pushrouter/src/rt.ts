// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type PushLevel = "info" | "success" | "warning" | "error";

export type PushLink = {
  surface?: string;
  ref?: string;
  href?: string;
};

export type PushMessageInput = {
  name: string;
  /** Recipient subject. Omitted means every session in the scope. */
  user?: string;
  /** Tenant. Service callers may address another scope; user callers cannot. */
  scope?: string;
  level?: PushLevel;
  titleKey?: string;
  title?: string;
  bodyKey?: string;
  body?: string;
  params?: Record<string, string | number>;
  link?: PushLink;
  payload?: unknown;
};

export type PushMessage = {
  id: string;
  name: string;
  level: PushLevel;
  at: number;
  titleKey?: string;
  title?: string;
  bodyKey?: string;
  body?: string;
  params?: Record<string, string | number>;
  link?: PushLink;
  payload?: unknown;
};

export type PushPublishResult = {
  id: string;
  /** Live sessions the message reached. Zero means nobody was connected. */
  delivered: number;
};

export type PushHistory = {
  count: number;
  messages: PushMessage[];
};

const metadata: ServiceMetadata = {
  "interfaceName": "PushRouterService",
  "serviceName": "pushrouter",
  "target": "fujin",
  "filePath": "platform/pushrouter.ts",
  "methods": [
    {
      "name": "publish",
      "parameters": [
        {
          "name": "message",
          "type": "PushMessageInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PushPublishResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "history",
      "parameters": [
        {
          "name": "limit",
          "type": "number",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "PushHistory",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "PushLevel",
      "kind": "type",
      "definition": "\"info\" | \"success\" | \"warning\" | \"error\""
    },
    {
      "name": "PushLink",
      "kind": "type",
      "definition": "{\n  surface?: string;\n  ref?: string;\n  href?: string;\n}"
    },
    {
      "name": "PushMessageInput",
      "kind": "type",
      "definition": "{\n  name: string;\n  /** Recipient subject. Omitted means every session in the scope. */\n  user?: string;\n  /** Tenant. Service callers may address another scope; user callers cannot. */\n  scope?: string;\n  level?: PushLevel;\n  titleKey?: string;\n  title?: string;\n  bodyKey?: string;\n  body?: string;\n  params?: Record<string, string | number>;\n  link?: PushLink;\n  payload?: unknown;\n}"
    },
    {
      "name": "PushMessage",
      "kind": "type",
      "definition": "{\n  id: string;\n  name: string;\n  level: PushLevel;\n  at: number;\n  titleKey?: string;\n  title?: string;\n  bodyKey?: string;\n  body?: string;\n  params?: Record<string, string | number>;\n  link?: PushLink;\n  payload?: unknown;\n}"
    },
    {
      "name": "PushPublishResult",
      "kind": "type",
      "definition": "{\n  id: string;\n  /** Live sessions the message reached. Zero means nobody was connected. */\n  delivered: number;\n}"
    },
    {
      "name": "PushHistory",
      "kind": "type",
      "definition": "{\n  count: number;\n  messages: PushMessage[];\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface PushRouterServiceRtClient {
  publish(message: PushMessageInput): PushPublishResult;
  history(limit?: number): PushHistory;
}

export function createPushRouterServiceRtClient(): PushRouterServiceRtClient {
  return createRtClient<PushRouterServiceRtClient>(metadata);
}
