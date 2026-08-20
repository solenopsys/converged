// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type PtahTaskRequest = {
  plugin: string;
  task: Record<string, unknown>;
  inputs?: Record<string, string>;
  outputs?: string[];
};

const metadata: ServiceMetadata = {
  "interfaceName": "RuntimePtahService",
  "serviceName": "ptah",
  "filePath": "ptah.ts",
  "methods": [
    {
      "name": "task.submit",
      "parameters": [
        {
          "name": "task",
          "type": "PtahTaskRequest",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "analyze",
      "parameters": [
        {
          "name": "task",
          "type": "PtahTaskRequest",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "unknown",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "PtahTaskRequest",
      "kind": "type",
      "definition": "{\n  plugin: string;\n  task: Record<string, unknown>;\n  inputs?: Record<string, string>;\n  outputs?: string[];\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface RuntimePtahServiceRtClient {
  "task.submit"(task: PtahTaskRequest): any;
  analyze(task: PtahTaskRequest): unknown;
}

export function createRuntimePtahServiceRtClient(): RuntimePtahServiceRtClient {
  return createRtClient<RuntimePtahServiceRtClient>(metadata);
}
