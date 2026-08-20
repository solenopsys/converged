// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
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

// Server interface (to be implemented in microservice)
export interface SmsService {
  sendSms(input: SmsMessageInput, credentials: SmsCredentials): Promise<SmsSendResult>;
}

// Client interface
export interface SmsServiceClient {
  sendSms(input: SmsMessageInput, credentials: SmsCredentials): Promise<SmsSendResult>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createSmsServiceClient(
  config: CrullerTransportClientConfig,
): SmsServiceClient {
  return createCrullerTransportClient<SmsServiceClient>(metadata, config);
}

export function createSmsServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): SmsServiceClient {
  return createSmsServiceClient(config);
}
