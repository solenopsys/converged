// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

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

const metadata: ServiceMetadata = {
  "interfaceName": "RuntimeGatesService",
  "serviceName": "gates",
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

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface RuntimeGatesServiceRtClient {
  sendMagicLink(params: MagicLinkParams): MagicLinkResult;
}

export function createRuntimeGatesServiceRtClient(): RuntimeGatesServiceRtClient {
  return createRtClient<RuntimeGatesServiceRtClient>(metadata);
}
