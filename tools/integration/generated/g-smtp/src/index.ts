// Auto-generated package
import { createHttpClient } from "nrpc";

export interface SmtpCredentials {
  host: string;
  port: number;
  secure: boolean;
  auth?: any;
}

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
  "filePath": "../types/smtp.ts",
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "SmtpCredentials",
      "definition": "",
      "properties": [
        {
          "name": "host",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "port",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "secure",
          "type": "boolean",
          "optional": false,
          "isArray": false
        },
        {
          "name": "auth",
          "type": "any",
          "optional": true,
          "isArray": false
        }
      ]
    },
    {
      "name": "EmailPayload",
      "definition": "{\n  from?: string;\n  to: string | string[];\n  subject: string;\n  body?: string;\n  type?: \"html\" | \"text\";\n}"
    },
    {
      "name": "EmailResult",
      "definition": "{\n  success: boolean;\n  messageId?: string;\n  error?: string;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface SmtpService {
  sendEmail(payload: EmailPayload, credentials: SmtpCredentials): Promise<any>;
}

// Client interface
export interface SmtpServiceClient {
  sendEmail(payload: EmailPayload, credentials: SmtpCredentials): Promise<any>;
}

// Factory function
export function createSmtpServiceClient(
  config?: { baseUrl?: string },
): SmtpServiceClient {
  return createHttpClient<SmtpServiceClient>(metadata, config);
}

// Ready-to-use client
export const smtpClient = createSmtpServiceClient();
