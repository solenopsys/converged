// Auto-generated frontend client
import { createHttpClient } from 'nrpc';

export type Hash = Uint8Array[32];

export type HashString = string;

export type EntityType = "node" | "receipt" | "provider";

export type Node = {
    id: number;
    name: string;
    current_version: Uint8Array;
};

export type NodeCode = {
    hash: Hash;
    body: Uint8Array;
    created_at: string;
};

export type Base64 = {
    base64: string;
};

const metadata = {
  "interfaceName": "DagService",
  "serviceName": "dag",
  "filePath": "/home/alexstorm/distrib/4ir/CONVERGED/public/dag/types/interface.ts",
  "methods": [
    {
      "name": "status",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    },
    {
      "name": "setNodeCode",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "code",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    },
    {
      "name": "createNode",
      "parameters": [
        {
          "name": "nodeCode",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "config",
          "type": "any",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    },
    {
      "name": "setProviderCode",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "code",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    },
    {
      "name": "createProvider",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "providerCodeName",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "config",
          "type": "any",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    },
    {
      "name": "nodeCodeList",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    },
    {
      "name": "providerCodeList",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    },
    {
      "name": "runCode",
      "parameters": [
        {
          "name": "hash",
          "type": "HashString",
          "optional": false,
          "isArray": false
        },
        {
          "name": "params",
          "type": "any",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    },
    {
      "name": "setParam",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "value",
          "type": "any",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    },
    {
      "name": "getParam",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    },
    {
      "name": "startProcess",
      "parameters": [
        {
          "name": "workflowId",
          "type": "string",
          "optional": true,
          "isArray": false
        },
        {
          "name": "meta",
          "type": "any",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    },
    {
      "name": "createWorkflow",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "nodes",
          "type": "HashString",
          "optional": false,
          "isArray": true
        },
        {
          "name": "links",
          "type": "any",
          "optional": false,
          "isArray": true
        },
        {
          "name": "description",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    },
    {
      "name": "createWebhook",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "url",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "method",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "workflowId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "options",
          "type": "any",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    }
  ],
  "types": [
    {
      "name": "Hash",
      "definition": "Uint8Array[32]"
    },
    {
      "name": "HashString",
      "definition": "string"
    },
    {
      "name": "EntityType",
      "definition": "\"node\" | \"receipt\" | \"provider\""
    },
    {
      "name": "Node",
      "definition": "{\n    id: number;\n    name: string;\n    current_version: Uint8Array;\n}"
    },
    {
      "name": "NodeCode",
      "definition": "{\n    hash: Hash;\n    body: Uint8Array;\n    created_at: string;\n}"
    },
    {
      "name": "Base64",
      "definition": "{\n    base64: string;\n}"
    }
  ]
};

// Service client interface
export interface DagServiceClient {
  status(): Promise<any>;
  setNodeCode(name: string, code: string): Promise<any>;
  createNode(nodeCode: string, config: any): Promise<any>;
  setProviderCode(name: string, code: string): Promise<any>;
  createProvider(name: string, providerCodeName: string, config: any): Promise<any>;
  nodeCodeList(): Promise<any>;
  providerCodeList(): Promise<any>;
  runCode(hash: HashString, params: any): Promise<any>;
  setParam(name: string, value: any): Promise<any>;
  getParam(name: string): Promise<any>;
  startProcess(workflowId?: string, meta?: any): Promise<any>;
  createWorkflow(name: string, nodes: HashString[], links: any[], description?: string): Promise<any>;
  createWebhook(name: string, url: string, method: string, workflowId: string, options?: any): Promise<any>;
}

// Factory function
export function createDagServiceClient(config?: { baseUrl?: string }): DagServiceClient {
  return createHttpClient<DagServiceClient>(metadata, config);
}

// Export ready-to-use client
export const dagClient = createDagServiceClient();
