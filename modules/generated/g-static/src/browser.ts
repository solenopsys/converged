// Auto-generated browser NRPC package
import {
  createWebSocketClient,
  type ServiceMetadata,
  type WebSocketClientConfig,
} from "nrpc";

export type StaticStatus = "todo" | "loaded" | "outdated";

export type StaticContentType = "html" | "svg";

export type StaticMeta = {
  id: string;
  status: StaticStatus;
  contentType: StaticContentType;
  size: number;
  loadedAt: number | null;
  updatedAt: number;
};

export type SetMetaParams = {
  id: string;
  contentType: StaticContentType;
  status?: StaticStatus;
};

export type SetDataParams = {
  id: string;
  content: string;
  contentType: StaticContentType;
};

export type ListMetaParams = {
  offset: number;
  limit: number;
  status?: StaticStatus;
  contentType?: StaticContentType;
  search?: string;
	filter?: FilterObject;
};

export type FilterObject = Record<string, unknown>;

export type SelectionFieldDescriptor = {
	id: string;
	label: string;
	valueType: "string" | "number" | "boolean" | "date" | "enum";
	operators: string[];
};

export type SelectionDescriptor = {
	objectType: string;
	title: string;
	fields: SelectionFieldDescriptor[];
	filterExample?: FilterObject;
	revision?: string;
};

export type SelectionStats = { totalCount: number };

export type StaticMetaListResult = {
  items: StaticMeta[];
  totalCount?: number;
};

export type FlushResult = {
  removed: number;
};

export type SetStatusPatternParams = {
  pattern: string;
  status: StaticStatus;
};

export type SetStatusPatternResult = {
  updated: number;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "StaticService",
  "serviceName": "static",
  "filePath": "content/static.ts",
  "methods": [
    {
      "name": "getData",
      "parameters": [
        {
          "name": "id",
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
      "name": "setData",
      "parameters": [
        {
          "name": "params",
          "type": "SetDataParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "StaticMeta",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "setMeta",
      "parameters": [
        {
          "name": "params",
          "type": "SetMetaParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "StaticMeta",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getMeta",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "StaticMeta | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listMeta",
      "parameters": [
        {
          "name": "params",
          "type": "ListMetaParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "StaticMetaListResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getOneByStatus",
      "parameters": [
        {
          "name": "status",
          "type": "StaticStatus",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "StaticMeta | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "setStatus",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "status",
          "type": "StaticStatus",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "StaticMeta",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "setStatusPattern",
      "parameters": [
        {
          "name": "params",
          "type": "SetStatusPatternParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "SetStatusPatternResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteMeta",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteEntry",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "flush",
      "parameters": [],
      "returnType": "FlushResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "describeSelection",
      "parameters": [
        {
          "name": "objectType",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "SelectionDescriptor",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "inspectCacheEntries",
      "parameters": [
        {
          "name": "filter",
          "type": "FilterObject",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "SelectionStats",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "StaticStatus",
      "kind": "type",
      "definition": "\"todo\" | \"loaded\" | \"outdated\""
    },
    {
      "name": "StaticContentType",
      "kind": "type",
      "definition": "\"html\" | \"svg\""
    },
    {
      "name": "StaticMeta",
      "kind": "type",
      "definition": "{\n  id: string;\n  status: StaticStatus;\n  contentType: StaticContentType;\n  size: number;\n  loadedAt: number | null;\n  updatedAt: number;\n}"
    },
    {
      "name": "SetMetaParams",
      "kind": "type",
      "definition": "{\n  id: string;\n  contentType: StaticContentType;\n  status?: StaticStatus;\n}"
    },
    {
      "name": "SetDataParams",
      "kind": "type",
      "definition": "{\n  id: string;\n  content: string;\n  contentType: StaticContentType;\n}"
    },
    {
      "name": "ListMetaParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  status?: StaticStatus;\n  contentType?: StaticContentType;\n  search?: string;\n\tfilter?: FilterObject;\n}"
    },
    {
      "name": "FilterObject",
      "kind": "type",
      "definition": "Record<string, unknown>"
    },
    {
      "name": "SelectionFieldDescriptor",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tlabel: string;\n\tvalueType: \"string\" | \"number\" | \"boolean\" | \"date\" | \"enum\";\n\toperators: string[];\n}"
    },
    {
      "name": "SelectionDescriptor",
      "kind": "type",
      "definition": "{\n\tobjectType: string;\n\ttitle: string;\n\tfields: SelectionFieldDescriptor[];\n\tfilterExample?: FilterObject;\n\trevision?: string;\n}"
    },
    {
      "name": "SelectionStats",
      "kind": "type",
      "definition": "{ totalCount: number }"
    },
    {
      "name": "StaticMetaListResult",
      "kind": "type",
      "definition": "{\n  items: StaticMeta[];\n  totalCount?: number;\n}"
    },
    {
      "name": "FlushResult",
      "kind": "type",
      "definition": "{\n  removed: number;\n}"
    },
    {
      "name": "SetStatusPatternParams",
      "kind": "type",
      "definition": "{\n  pattern: string;\n  status: StaticStatus;\n}"
    },
    {
      "name": "SetStatusPatternResult",
      "kind": "type",
      "definition": "{\n  updated: number;\n}"
    }
  ]
};

// Client interface
export interface StaticServiceClient {
  getData(id: string): Promise<string | any>;
  setData(params: SetDataParams): Promise<StaticMeta>;
  setMeta(params: SetMetaParams): Promise<StaticMeta>;
  getMeta(id: string): Promise<StaticMeta | any>;
  listMeta(params: ListMetaParams): Promise<StaticMetaListResult>;
  getOneByStatus(status: StaticStatus): Promise<StaticMeta | any>;
  setStatus(id: string, status: StaticStatus): Promise<StaticMeta>;
  setStatusPattern(params: SetStatusPatternParams): Promise<SetStatusPatternResult>;
  deleteMeta(id: string): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  flush(): Promise<FlushResult>;
  describeSelection(objectType: string): Promise<SelectionDescriptor>;
  inspectCacheEntries(filter?: FilterObject): Promise<SelectionStats>;
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function createStaticServiceClient(
  config: WebSocketClientConfig,
): StaticServiceClient {
  return createWebSocketClient<StaticServiceClient>(metadata, config);
}

export function createStaticServiceWebSocketClient(
  config: WebSocketClientConfig,
): StaticServiceClient {
  return createStaticServiceClient(config);
}
