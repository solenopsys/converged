// Auto-generated package
import { createHttpClient } from "nrpc";

export type MagicLinkParams = {
  email: string;
  returnTo?: string;
  locale?: string;
  channel?: string;
  templateId?: string;
};

export type MagicLinkResult = {
  success: boolean;
};

export const metadata = {
  "interfaceName": "RuntimeGatesService",
  "serviceName": "gates",
  "packageName": "g-rt-gates",
  "filePath": "runtime/automation/gates.ts",
  "methods": [
    {
      "name": "sendMagicLink",
      "parameters": [
        {
          "name": "params",
          "type": "MagicLinkParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "MagicLinkResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "MagicLinkParams",
      "kind": "type",
      "definition": "{\n  email: string;\n  returnTo?: string;\n  locale?: string;\n  channel?: string;\n  templateId?: string;\n}"
    },
    {
      "name": "MagicLinkResult",
      "kind": "type",
      "definition": "{\n  success: boolean;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface RuntimeGatesService {
  sendMagicLink(params: MagicLinkParams): Promise<MagicLinkResult>;
}

// Client interface
export interface RuntimeGatesServiceClient {
  sendMagicLink(params: MagicLinkParams): Promise<MagicLinkResult>;
}

// Factory function
export function createRuntimeGatesServiceClient(
  config?: { baseUrl?: string },
): RuntimeGatesServiceClient {
  return createHttpClient<RuntimeGatesServiceClient>(metadata, config);
}

// Ready-to-use client
export const gatesClient = createRuntimeGatesServiceClient();
