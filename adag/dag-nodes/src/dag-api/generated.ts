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

export type Workflow = {
    nodes: { [name: string]:  HashString }; 
    links: { from: string, to: string }[]; 
    description?: string
};

export type NodeCode = {
    hash: Hash;
    body: Uint8Array;
    created_at: string;
};

export type CodeSource = {
    name: string;
    version: string;
    hash: HashString;
    fields: { name: string, type: string }[]
};

export interface PaginationParams {
  offset: number;
  limit: number;
}

export interface PaginatedResult {
  items: T[];
  totalCount?: number;
}

export type Base64 = {
    base64: string;
};

const metadata = {
  "interfaceName": "DagService",
  "serviceName": "dag",
  "filePath": "/home/alexstorm/distrib/4ir/CONVERGED/public/adag/dag-types/interface.ts",
  "methods": [
    {
      "name": "status",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "setCodeSource",
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
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getCodeSourceVersions",
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
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "codeSourceList",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "createNode",
      "parameters": [
        {
          "name": "nodeName",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "hash",
          "type": "HashString",
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
      "name": "createNodeConfig",
      "parameters": [
        {
          "name": "codeSourceName",
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
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getNode",
      "parameters": [
        {
          "name": "hash",
          "type": "HashString",
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
      "name": "nodeList",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
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
          "name": "workflow",
          "type": "Workflow",
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
      "name": "getWorkflowConfig",
      "parameters": [
        {
          "name": "hash",
          "type": "HashString",
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
      "name": "getWorkflowVersions",
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
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getWorkflowConfigByName",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "version",
          "type": "string",
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
      "name": "workflowList",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
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
          "name": "codeSourceName",
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
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "providerList",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "runLambda",
      "parameters": [
        {
          "name": "name",
          "type": "string",
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
      "returnTypeIsArray": false,
      "isAsyncIterable": false
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
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "run",
      "parameters": [
        {
          "name": "pid",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "workflow",
          "type": "HashString",
          "optional": false,
          "isArray": false
        },
        {
          "name": "command",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "params",
          "type": "any",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": true
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
      "returnTypeIsArray": false,
      "isAsyncIterable": false
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
      "returnTypeIsArray": false,
      "isAsyncIterable": false
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
      "returnTypeIsArray": false,
      "isAsyncIterable": false
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
      "returnTypeIsArray": false,
      "isAsyncIterable": false
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
      "name": "Workflow",
      "definition": "{\n    nodes: { [name: string]:  HashString }; \n    links: { from: string, to: string }[]; \n    description?: string\n}"
    },
    {
      "name": "NodeCode",
      "definition": "{\n    hash: Hash;\n    body: Uint8Array;\n    created_at: string;\n}"
    },
    {
      "name": "CodeSource",
      "definition": "{\n    name: string;\n    version: string;\n    hash: HashString;\n    fields: { name: string, type: string }[]\n}"
    },
    {
      "name": "PaginationParams",
      "definition": "",
      "properties": [
        {
          "name": "offset",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "limit",
          "type": "number",
          "optional": false,
          "isArray": false
        }
      ]
    },
    {
      "name": "PaginatedResult",
      "definition": "",
      "properties": [
        {
          "name": "items",
          "type": "T",
          "optional": false,
          "isArray": true
        },
        {
          "name": "totalCount",
          "type": "number",
          "optional": true,
          "isArray": false
        }
      ]
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
  setCodeSource(name: string, code: string): Promise<any>;
  getCodeSourceVersions(name: string): Promise<any>;
  codeSourceList(): Promise<any>;
  createNode(nodeName: string, hash: HashString): Promise<any>;
  createNodeConfig(codeSourceName: string, config: any): Promise<any>;
  getNode(hash: HashString): Promise<any>;
  nodeList(): Promise<any>;
  createWorkflow(name: string, workflow: Workflow): Promise<any>;
  getWorkflowConfig(hash: HashString): Promise<any>;
  getWorkflowVersions(name: string): Promise<any>;
  getWorkflowConfigByName(name: string, version: string): Promise<any>;
  workflowList(): Promise<any>;
  createProvider(name: string, codeSourceName: string, config: any): Promise<any>;
  providerList(): Promise<any>;
  runLambda(name: string, params: any): Promise<any>;
  runCode(hash: HashString, params: any): Promise<any>;
  run(pid: string, workflow: HashString, command: string, params?: any): AsyncIterable<any>;
  setParam(name: string, value: any): Promise<any>;
  getParam(name: string): Promise<any>;
  startProcess(workflowId?: string, meta?: any): Promise<any>;
  createWebhook(name: string, url: string, method: string, workflowId: string, options?: any): Promise<any>;
}

// Factory function
export function createDagServiceClient(config?: { baseUrl?: string }): DagServiceClient {
  return createHttpClient<DagServiceClient>(metadata, config);
}

// Export ready-to-use client
export const dagClient = createDagServiceClient();
