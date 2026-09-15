// Auto-generated browser NRPC package
import {
  createWebSocketClient,
  type ServiceMetadata,
  type WebSocketClientConfig,
} from "nrpc";

export type SmtpCredentials = {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
};

export type EmailPayload = {
  from?: string;
  to: string | string[];
  subject: string;
  body?: string;
  type?: "html" | "text";
  /**
   * The plain-text alternative of an html `body`, sent alongside it as
   * multipart/alternative. An html letter without one reads as spam to filters
   * and as nothing to a text-only client.
   */
  text?: string;
};

export type EmailResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "SmtpService",
  "serviceName": "smtp",
  "filePath": "providers/smtp.ts",
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
          "type": "SmtpCredentials",
          "optional": true,
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
      "name": "SmtpCredentials",
      "kind": "type",
      "definition": "{\n  host: string;\n  port: number;\n  secure: boolean;\n  auth?: {\n    user: string;\n    pass: string;\n  };\n}"
    },
    {
      "name": "EmailPayload",
      "kind": "type",
      "definition": "{\n  from?: string;\n  to: string | string[];\n  subject: string;\n  body?: string;\n  type?: \"html\" | \"text\";\n  /**\n   * The plain-text alternative of an html `body`, sent alongside it as\n   * multipart/alternative. An html letter without one reads as spam to filters\n   * and as nothing to a text-only client.\n   */\n  text?: string;\n}"
    },
    {
      "name": "EmailResult",
      "kind": "type",
      "definition": "{\n  success: boolean;\n  messageId?: string;\n  error?: string;\n}"
    }
  ]
};

// Client interface
export interface SmtpServiceClient {
  sendEmail(payload: EmailPayload, credentials?: SmtpCredentials): Promise<EmailResult>;
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function createSmtpServiceClient(
  config: WebSocketClientConfig,
): SmtpServiceClient {
  return createWebSocketClient<SmtpServiceClient>(metadata, config);
}

export function createSmtpServiceWebSocketClient(
  config: WebSocketClientConfig,
): SmtpServiceClient {
  return createSmtpServiceClient(config);
}
