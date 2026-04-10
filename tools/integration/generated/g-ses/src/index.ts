// Auto-generated package
import { createHttpClient } from "nrpc";

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

export const metadata = {
  "interfaceName": "SesService",
  "serviceName": "ses",
  "filePath": "../types/ses.ts",
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
      "definition": "{\n  accessKeyId: string;\n  secretAccessKey: string;\n  region: string;\n}"
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
export interface SesService {
  sendEmail(payload: EmailPayload, credentials: SesCredentials): Promise<EmailResult>;
}

// Client interface
export interface SesServiceClient {
  sendEmail(payload: EmailPayload, credentials: SesCredentials): Promise<EmailResult>;
}

// Factory function
export function createSesServiceClient(
  config?: { baseUrl?: string },
): SesServiceClient {
  return createHttpClient<SesServiceClient>(metadata, config);
}

// Ready-to-use client
export const sesClient = createSesServiceClient();
