// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type CentimanusWorkflowResult = {
	executionId: string;
	ok: boolean;
	result?: unknown;
	error?: string;
};

const metadata: ServiceMetadata = {
  "interfaceName": "CentimanusService",
  "serviceName": "centimanus",
  "filePath": "automation/centimanus.ts",
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
      "definition": "{\n\texecutionId: string;\n\tok: boolean;\n\tresult?: unknown;\n\terror?: string;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface CentimanusServiceRtClient {
  runWorkflow(scriptPath: string, params: Record<string, unknown>): CentimanusWorkflowResult;
}

export function createCentimanusServiceRtClient(): CentimanusServiceRtClient {
  return createRtClient<CentimanusServiceRtClient>(metadata);
}
