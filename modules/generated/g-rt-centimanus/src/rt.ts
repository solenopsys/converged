// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type CentimanusWorkflowResult = {
  executionId: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};

const metadata: ServiceMetadata = {
  "interfaceName": "RuntimeCentimanusService",
  "serviceName": "centimanus",
  "filePath": "centimanus.ts",
  "methods": [
    {
      "name": "runWorkflow",
      "parameters": [
        {
          "name": "scriptPath",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "params",
          "type": "Record<string, unknown>",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "CentimanusWorkflowResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "CentimanusWorkflowResult",
      "kind": "type",
      "definition": "{\n  executionId: string;\n  ok: boolean;\n  result?: unknown;\n  error?: string;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface RuntimeCentimanusServiceRtClient {
  runWorkflow(scriptPath: string, params: Record<string, unknown>): CentimanusWorkflowResult;
}

export function createRuntimeCentimanusServiceRtClient(): RuntimeCentimanusServiceRtClient {
  return createRtClient<RuntimeCentimanusServiceRtClient>(metadata);
}
