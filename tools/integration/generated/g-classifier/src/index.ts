// Auto-generated package
import { createHttpClient } from "nrpc";

export type ClassifierNode = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
};

export const metadata = {
  "interfaceName": "ClassifierService",
  "serviceName": "classifier",
  "filePath": "../types/classifier.ts",
  "methods": [
    {
      "name": "addNode",
      "parameters": [
        {
          "name": "node",
          "type": "any",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "string",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getNode",
      "parameters": [
        {
          "name": "id",
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
      "name": "getChildren",
      "parameters": [
        {
          "name": "parentId",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ClassifierNode",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "listRoots",
      "parameters": [],
      "returnType": "ClassifierNode",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "ClassifierNode",
      "definition": "{\n  id: string;\n  parentId: string | null;\n  name: string;\n  slug: string;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface ClassifierService {
  addNode(node: any): Promise<string>;
  getNode(id: string): Promise<any>;
  getChildren(parentId: string): Promise<ClassifierNode[]>;
  listRoots(): Promise<ClassifierNode[]>;
}

// Client interface
export interface ClassifierServiceClient {
  addNode(node: any): Promise<string>;
  getNode(id: string): Promise<any>;
  getChildren(parentId: string): Promise<ClassifierNode[]>;
  listRoots(): Promise<ClassifierNode[]>;
}

// Factory function
export function createClassifierServiceClient(
  config?: { baseUrl?: string },
): ClassifierServiceClient {
  return createHttpClient<ClassifierServiceClient>(metadata, config);
}

// Ready-to-use client
export const classifierClient = createClassifierServiceClient();
