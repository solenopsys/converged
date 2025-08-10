// Auto-generated frontend client
import { createHttpClient } from 'nrpc';

export type Hash = Uint8Array[32];

export type HashString = string;

export type EntityType = "node"|"receipt"|"provider";

export type Node = {
    id: number;
    name: string;
    current_version: Uint8Array; 
  };

export type NodeCode = {
    hash:Hash;
    body:Uint8Array;
    created_at:string;
};

export type Base64 = {
    base64:string;
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
      "name": "setCode",
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
      "name": "codeList",
      "parameters": [],
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
      "definition": "\"node\"|\"receipt\"|\"provider\""
    },
    {
      "name": "Node",
      "definition": "{\n    id: number;\n    name: string;\n    current_version: Uint8Array; \n  }"
    },
    {
      "name": "NodeCode",
      "definition": "{\n    hash:Hash;\n    body:Uint8Array;\n    created_at:string;\n}"
    },
    {
      "name": "Base64",
      "definition": "{\n    base64:string;\n}"
    }
  ]
};

// Service client interface
export interface DagServiceClient {
  status(): Promise<any>;
  setCode(name: string, code: string): Promise<any>;
  codeList(): Promise<any>;
}

// Factory function
export function createDagServiceClient(config?: { baseUrl?: string }): DagServiceClient {
  return createHttpClient<DagServiceClient>(metadata, config);
}

// Export ready-to-use client
export const dagClient = createDagServiceClient();
