// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

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

const metadata: ServiceMetadata = {
  "interfaceName": "SmsService",
  "serviceName": "sms",
  "filePath": "services/providers/sms.ts",
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

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface SmsServiceRtClient {
  sendSms(input: SmsMessageInput, credentials: SmsCredentials): SmsSendResult;
}

export function createSmsServiceRtClient(): SmsServiceRtClient {
  return createRtClient<SmsServiceRtClient>(metadata);
}
