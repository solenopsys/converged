// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export interface RuntimeWorkflowResult {
  executionId: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

const metadata: ServiceMetadata = {
  "interfaceName": "RuntimeDagService",
  "serviceName": "dag",
  "filePath": "dag.ts",
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
      "returnType": "RuntimeWorkflowResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "RuntimeWorkflowResult",
      "definition": "",
      "kind": "interface",
      "properties": [
        {
          "name": "executionId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "ok",
          "type": "boolean",
          "optional": false,
          "isArray": false
        },
        {
          "name": "result",
          "type": "unknown",
          "optional": true,
          "isArray": false
        },
        {
          "name": "error",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ]
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface RuntimeDagServiceRtClient {
  runWorkflow(scriptPath: string, params: Record<string, unknown>): RuntimeWorkflowResult;
}

export function createRuntimeDagServiceRtClient(): RuntimeDagServiceRtClient {
  return createRtClient<RuntimeDagServiceRtClient>(metadata);
}
