// Auto-generated package
import { createHttpClient } from "nrpc";

export type PushUrgency = "very-low" | "low" | "normal" | "high";

export type WebPushKeys = {
  p256dh: string;
  auth: string;
};

export type WebPushSubscription = {
  endpoint: string;
  keys: WebPushKeys;
};

export type PushCredentials = {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  subject: string;
};

export type PushMessageInput = {
  subscription: WebPushSubscription;
  payload?: string;
  ttl?: number;
  urgency?: PushUrgency;
  topic?: string;
};

export type PushSendResult = {
  success: boolean;
  statusCode?: number;
  body?: string;
  error?: string;
};

export const metadata = {
  "interfaceName": "PushService",
  "serviceName": "push",
  "filePath": "services/providers/push.ts",
  "methods": [
    {
      "name": "sendPush",
      "parameters": [
        {
          "name": "input",
          "type": "PushMessageInput",
          "optional": false,
          "isArray": false
        },
        {
          "name": "credentials",
          "type": "PushCredentials",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PushSendResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "PushUrgency",
      "kind": "type",
      "definition": "\"very-low\" | \"low\" | \"normal\" | \"high\""
    },
    {
      "name": "WebPushKeys",
      "kind": "type",
      "definition": "{\n  p256dh: string;\n  auth: string;\n}"
    },
    {
      "name": "WebPushSubscription",
      "kind": "type",
      "definition": "{\n  endpoint: string;\n  keys: WebPushKeys;\n}"
    },
    {
      "name": "PushCredentials",
      "kind": "type",
      "definition": "{\n  vapidPublicKey: string;\n  vapidPrivateKey: string;\n  subject: string;\n}"
    },
    {
      "name": "PushMessageInput",
      "kind": "type",
      "definition": "{\n  subscription: WebPushSubscription;\n  payload?: string;\n  ttl?: number;\n  urgency?: PushUrgency;\n  topic?: string;\n}"
    },
    {
      "name": "PushSendResult",
      "kind": "type",
      "definition": "{\n  success: boolean;\n  statusCode?: number;\n  body?: string;\n  error?: string;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface PushService {
  sendPush(input: PushMessageInput, credentials: PushCredentials): Promise<PushSendResult>;
}

// Client interface
export interface PushServiceClient {
  sendPush(input: PushMessageInput, credentials: PushCredentials): Promise<PushSendResult>;
}

// Factory function
export function createPushServiceClient(
  config?: { baseUrl?: string },
): PushServiceClient {
  return createHttpClient<PushServiceClient>(metadata, config);
}

// Ready-to-use client
export const pushClient = createPushServiceClient();
