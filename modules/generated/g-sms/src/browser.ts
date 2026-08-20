// Auto-generated browser NRPC package
import {
  createWebSocketClient,
  type ServiceMetadata,
  type WebSocketClientConfig,
} from "nrpc";

export type SmsMessageInput = {
  to: string;
  text: string;
  from?: string;
  messagingProfileId?: string;
};

export type SmsCredentials = {
  apiKey: string;
  from?: string;
  messagingProfileId?: string;
};

export type SmsSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "SmsService",
  "serviceName": "sms",
  "filePath": "providers/sms.ts",
  "methods": [
    {
      "name": "sendSms",
      "parameters": [
        {
          "name": "input",
          "type": "SmsMessageInput",
          "optional": false,
          "isArray": false
        },
        {
          "name": "credentials",
          "type": "SmsCredentials",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "SmsSendResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "SmsMessageInput",
      "kind": "type",
      "definition": "{\n  to: string;\n  text: string;\n  from?: string;\n  messagingProfileId?: string;\n}"
    },
    {
      "name": "SmsCredentials",
      "kind": "type",
      "definition": "{\n  apiKey: string;\n  from?: string;\n  messagingProfileId?: string;\n}"
    },
    {
      "name": "SmsSendResult",
      "kind": "type",
      "definition": "{\n  success: boolean;\n  messageId?: string;\n  error?: string;\n}"
    }
  ]
};

// Client interface
export interface SmsServiceClient {
  sendSms(input: SmsMessageInput, credentials: SmsCredentials): Promise<SmsSendResult>;
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function createSmsServiceClient(
  config: WebSocketClientConfig,
): SmsServiceClient {
  return createWebSocketClient<SmsServiceClient>(metadata, config);
}

export function createSmsServiceWebSocketClient(
  config: WebSocketClientConfig,
): SmsServiceClient {
  return createSmsServiceClient(config);
}
