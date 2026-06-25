// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

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

const metadata: ServiceMetadata = {
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

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface SmtpServiceRtClient {
  sendEmail(payload: EmailPayload, credentials: SmtpCredentials): EmailResult;
}

export function createSmtpServiceRtClient(): SmtpServiceRtClient {
  return createRtClient<SmtpServiceRtClient>(metadata);
}
