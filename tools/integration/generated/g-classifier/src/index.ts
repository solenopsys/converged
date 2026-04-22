// Auto-generated package
import { createHttpClient } from "nrpc";

export type ClassifierNode = {
	id: string;
	parentId: string | null;
	name: string;
	slug: string;
};

export type ClassifierTreeNode = ClassifierNode & {
	childrenCount: number;
};

export type ClassifierMapping = {
	id: string;
	groupId: string;
	key: string;
	value: string;
	priority: number;
	createdAt?: Date;
	updatedAt?: Date;
};

export type ClassifierMappingInput = {
	id?: string;
	groupId: string;
	key: string;
	value: string;
	priority?: number;
};

export type PaginationParams = {
	offset: number;
	limit: number;
};

export type PaginatedResult<T> = {
	items: T[];
	totalCount?: number;
};

export type ClassifierMappingGroup = {
	groupId: string;
	count: number;
};

export const metadata = {
  "interfaceName": "ClassifierService",
  "serviceName": "classifier",
  "filePath": "services/content/classifier.ts",
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
      "returnType": "ClassifierNode | any",
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
    },
    {
      "name": "listNodes",
      "parameters": [
        {
          "name": "params",
          "type": "PaginationParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<ClassifierNode>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listTreeChildren",
      "parameters": [
        {
          "name": "parentId",
          "type": "string | any",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "ClassifierTreeNode",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "setMapping",
      "parameters": [
        {
          "name": "mapping",
          "type": "ClassifierMappingInput",
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
      "name": "getMapping",
      "parameters": [
        {
          "name": "groupId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "key",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ClassifierMapping | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "resolveMapping",
      "parameters": [
        {
          "name": "groupId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "key",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "string | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listMappings",
      "parameters": [
        {
          "name": "groupId",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ClassifierMapping",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "listMappingGroups",
      "parameters": [],
      "returnType": "ClassifierMappingGroup",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "deleteMapping",
      "parameters": [
        {
          "name": "groupId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "key",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "boolean",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "ClassifierNode",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tparentId: string | null;\n\tname: string;\n\tslug: string;\n}"
    },
    {
      "name": "ClassifierTreeNode",
      "kind": "type",
      "definition": "ClassifierNode & {\n\tchildrenCount: number;\n}"
    },
    {
      "name": "ClassifierMapping",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tgroupId: string;\n\tkey: string;\n\tvalue: string;\n\tpriority: number;\n\tcreatedAt?: Date;\n\tupdatedAt?: Date;\n}"
    },
    {
      "name": "ClassifierMappingInput",
      "kind": "type",
      "definition": "{\n\tid?: string;\n\tgroupId: string;\n\tkey: string;\n\tvalue: string;\n\tpriority?: number;\n}"
    },
    {
      "name": "PaginationParams",
      "kind": "type",
      "definition": "{\n\toffset: number;\n\tlimit: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n\titems: T[];\n\ttotalCount?: number;\n}"
    },
    {
      "name": "ClassifierMappingGroup",
      "kind": "type",
      "definition": "{\n\tgroupId: string;\n\tcount: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface ClassifierService {
  addNode(node: any): Promise<string>;
  getNode(id: string): Promise<ClassifierNode | any>;
  getChildren(parentId: string): Promise<ClassifierNode[]>;
  listRoots(): Promise<ClassifierNode[]>;
  listNodes(params: PaginationParams): Promise<PaginatedResult<ClassifierNode>>;
  listTreeChildren(parentId?: string | any): Promise<ClassifierTreeNode[]>;
  setMapping(mapping: ClassifierMappingInput): Promise<string>;
  getMapping(groupId: string, key: string): Promise<ClassifierMapping | any>;
  resolveMapping(groupId: string, key: string): Promise<string | any>;
  listMappings(groupId: string): Promise<ClassifierMapping[]>;
  listMappingGroups(): Promise<ClassifierMappingGroup[]>;
  deleteMapping(groupId: string, key: string): Promise<boolean>;
}

// Client interface
export interface ClassifierServiceClient {
  addNode(node: any): Promise<string>;
  getNode(id: string): Promise<ClassifierNode | any>;
  getChildren(parentId: string): Promise<ClassifierNode[]>;
  listRoots(): Promise<ClassifierNode[]>;
  listNodes(params: PaginationParams): Promise<PaginatedResult<ClassifierNode>>;
  listTreeChildren(parentId?: string | any): Promise<ClassifierTreeNode[]>;
  setMapping(mapping: ClassifierMappingInput): Promise<string>;
  getMapping(groupId: string, key: string): Promise<ClassifierMapping | any>;
  resolveMapping(groupId: string, key: string): Promise<string | any>;
  listMappings(groupId: string): Promise<ClassifierMapping[]>;
  listMappingGroups(): Promise<ClassifierMappingGroup[]>;
  deleteMapping(groupId: string, key: string): Promise<boolean>;
}

// Factory function
export function createClassifierServiceClient(
  config?: { baseUrl?: string },
): ClassifierServiceClient {
  return createHttpClient<ClassifierServiceClient>(metadata, config);
}

// Ready-to-use client
export const classifierClient = createClassifierServiceClient();
