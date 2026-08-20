// Auto-generated browser NRPC package
import {
  createWebSocketClient,
  type ServiceMetadata,
  type WebSocketClientConfig,
} from "nrpc";

export type SesCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

export type EmailPayload = {
  from?: string;
  to: string | string[];
  subject: string;
  body?: string;
  type?: "html" | "text";
};

export type EmailResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "SesService",
  "serviceName": "ses",
  "filePath": "providers/ses.ts",
  "methods": [
    {
      "name": "sendEmail",
      "parameters": [
        {
          "name": "payload",
          "type": "EmailPayload",
          "optional": false,
          "isArray": false
        },
        {
          "name": "credentials",
          "type": "SesCredentials",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "EmailResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "SesCredentials",
      "kind": "type",
      "definition": "{\n  accessKeyId: string;\n  secretAccessKey: string;\n  region: string;\n}"
    },
    {
      "name": "EmailPayload",
      "kind": "type",
      "definition": "{\n  from?: string;\n  to: string | string[];\n  subject: string;\n  body?: string;\n  type?: \"html\" | \"text\";\n}"
    },
    {
      "name": "EmailResult",
      "kind": "type",
      "definition": "{\n  success: boolean;\n  messageId?: string;\n  error?: string;\n}"
    }
  ]
};

// Client interface
export interface SesServiceClient {
  sendEmail(payload: EmailPayload, credentials: SesCredentials): Promise<EmailResult>;
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function createSesServiceClient(
  config: WebSocketClientConfig,
): SesServiceClient {
  return createWebSocketClient<SesServiceClient>(metadata, config);
}

export function createSesServiceWebSocketClient(
  config: WebSocketClientConfig,
): SesServiceClient {
  return createSesServiceClient(config);
}
