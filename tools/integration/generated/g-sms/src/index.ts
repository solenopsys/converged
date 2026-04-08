// Auto-generated package
import { createHttpClient } from "nrpc";

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

export const metadata = {
  "interfaceName": "SmsService",
  "serviceName": "sms",
  "filePath": "../types/sms.ts",
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "SmsMessageInput",
      "definition": "{\n  to: string;\n  text: string;\n  from?: string;\n  messagingProfileId?: string;\n}"
    },
    {
      "name": "SmsCredentials",
      "definition": "{\n  apiKey: string;\n  from?: string;\n  messagingProfileId?: string;\n}"
    },
    {
      "name": "SmsSendResult",
      "definition": "{\n  success: boolean;\n  messageId?: string;\n  error?: string;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface SmsService {
  sendSms(input: SmsMessageInput, credentials: SmsCredentials): Promise<any>;
}

// Client interface
export interface SmsServiceClient {
  sendSms(input: SmsMessageInput, credentials: SmsCredentials): Promise<any>;
}

// Factory function
export function createSmsServiceClient(
  config?: { baseUrl?: string },
): SmsServiceClient {
  return createHttpClient<SmsServiceClient>(metadata, config);
}

// Ready-to-use client
export const smsClient = createSmsServiceClient();
