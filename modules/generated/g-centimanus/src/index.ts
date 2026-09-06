// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

export type CentimanusWorkflowResult = {
	executionId: string;
	ok: boolean;
	result?: unknown;
	error?: string;
};

export type CentimanusEventResult = {
	/** Execution ids the event started, one per matching trigger. */
	started: string[];
};

export const metadata: ServiceMetadata = {
  "interfaceName": "CentimanusService",
  "serviceName": "centimanus",
  "target": "centimanus",
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
    },
    {
      "name": "onEvent",
      "parameters": [
        {
          "name": "event",
          "type": "Record<string, unknown>",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "CentimanusEventResult",
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
    },
    {
      "name": "CentimanusEventResult",
      "kind": "type",
      "definition": "{\n\t/** Execution ids the event started, one per matching trigger. */\n\tstarted: string[];\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface CentimanusService {
  runWorkflow(scriptPath: string, params: Record<string, unknown>): Promise<CentimanusWorkflowResult>;
  onEvent(event: Record<string, unknown>): Promise<CentimanusEventResult>;
}

// Client interface
export interface CentimanusServiceClient {
  runWorkflow(scriptPath: string, params: Record<string, unknown>): Promise<CentimanusWorkflowResult>;
  onEvent(event: Record<string, unknown>): Promise<CentimanusEventResult>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createCentimanusServiceClient(
  config: CrullerTransportClientConfig,
): CentimanusServiceClient {
  return createCrullerTransportClient<CentimanusServiceClient>(metadata, config);
}

export function createCentimanusServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): CentimanusServiceClient {
  return createCentimanusServiceClient(config);
}
