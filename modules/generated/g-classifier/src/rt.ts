// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

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

export type ClassifierMappingsInput = {
	groupId: string;
	mappings: {
		key: string;
		value?: string;
		priority?: number;
	}[];
};

export type ClassifierMappingGroup = {
	groupId: string;
	count: number;
};

const metadata: ServiceMetadata = {
  "interfaceName": "ClassifierService",
  "serviceName": "classifier",
  "filePath": "content/classifier.ts",
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
      "name": "setMappings",
      "parameters": [
        {
          "name": "input",
          "type": "ClassifierMappingsInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "number",
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
      "name": "ClassifierMappingsInput",
      "kind": "type",
      "definition": "{\n\tgroupId: string;\n\tmappings: {\n\t\tkey: string;\n\t\tvalue?: string;\n\t\tpriority?: number;\n\t}[];\n}"
    },
    {
      "name": "ClassifierMappingGroup",
      "kind": "type",
      "definition": "{\n\tgroupId: string;\n\tcount: number;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface ClassifierServiceRtClient {
  addNode(node: any): string;
  getNode(id: string): ClassifierNode | any;
  getChildren(parentId: string): ClassifierNode[];
  listRoots(): ClassifierNode[];
  listNodes(params: PaginationParams): PaginatedResult<ClassifierNode>;
  listTreeChildren(parentId?: string | any): ClassifierTreeNode[];
  setMapping(mapping: ClassifierMappingInput): string;
  setMappings(input: ClassifierMappingsInput): number;
  getMapping(groupId: string, key: string): ClassifierMapping | any;
  resolveMapping(groupId: string, key: string): string | any;
  listMappings(groupId: string): ClassifierMapping[];
  listMappingGroups(): ClassifierMappingGroup[];
  deleteMapping(groupId: string, key: string): boolean;
}

export function createClassifierServiceRtClient(): ClassifierServiceRtClient {
  return createRtClient<ClassifierServiceRtClient>(metadata);
}
