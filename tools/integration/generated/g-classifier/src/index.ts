// Auto-generated package
import { createHttpClient } from "nrpc";

export interface ClassifierNode {
  id: string;
  parentId: any;
  name: string;
  slug: string;
}

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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false,
      "isPublic": false
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
      "isAsyncIterable": false,
      "isPublic": false
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false,
      "isPublic": false
    },
    {
      "name": "listRoots",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false,
      "isPublic": false
    }
  ],
  "types": [
    {
      "name": "ClassifierNode",
      "definition": "",
      "properties": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "parentId",
          "type": "any",
          "optional": false,
          "isArray": false
        },
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "slug",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ]
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface ClassifierService {
  addNode(node: any): Promise<any>;
  getNode(id: string): Promise<any>;
  getChildren(parentId: string): Promise<any>;
  listRoots(): Promise<any>;
}

// Client interface
export interface ClassifierServiceClient {
  addNode(node: any): Promise<any>;
  getNode(id: string): Promise<any>;
  getChildren(parentId: string): Promise<any>;
  listRoots(): Promise<any>;
}

// Factory function
export function createClassifierServiceClient(
  config?: { baseUrl?: string },
): ClassifierServiceClient {
  return createHttpClient<ClassifierServiceClient>(metadata, config);
}

// Ready-to-use client
export const classifierClient = createClassifierServiceClient();
