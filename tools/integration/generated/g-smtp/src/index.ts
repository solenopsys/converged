// Auto-generated package
import { createHttpClient } from "nrpc";

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
};

export type EmailResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export const metadata = {
  "interfaceName": "SmtpService",
  "serviceName": "smtp",
  "filePath": "services/providers/smtp.ts",
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
      "name": "SmtpCredentials",
      "kind": "type",
      "definition": "{\n  host: string;\n  port: number;\n  secure: boolean;\n  auth?: {\n    user: string;\n    pass: string;\n  };\n}"
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

// Server interface (to be implemented in microservice)
export interface SmtpService {
  sendEmail(payload: EmailPayload, credentials: SmtpCredentials): Promise<EmailResult>;
}

// Client interface
export interface SmtpServiceClient {
  sendEmail(payload: EmailPayload, credentials: SmtpCredentials): Promise<EmailResult>;
}

// Factory function
export function createSmtpServiceClient(
  config?: { baseUrl?: string },
): SmtpServiceClient {
  return createHttpClient<SmtpServiceClient>(metadata, config);
}

// Ready-to-use client
export const smtpClient = createSmtpServiceClient();
