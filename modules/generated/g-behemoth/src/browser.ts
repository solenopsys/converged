// Auto-generated browser NRPC package
import {
  createWebSocketClient,
  type ServiceMetadata,
  type WebSocketClientConfig,
} from "nrpc";

export type StorageMemoryStore = {
	name: string;
	type: string;
	memoryBytes: number;
	pageCacheBytes?: number;
	schemaBytes?: number;
	statementBytes?: number;
	residentBytes?: number;
	bufferPoolBytes?: number;
};

export type StorageMemoryEngine = {
	memoryBytes: number;
	stores: StorageMemoryStore[];
};

export type StorageMemoryStats = {
	valkey: {
		memoryBytes: number;
	};
	engines: {
		sqlite: StorageMemoryEngine;
		lmdbx: StorageMemoryEngine;
		graph: StorageMemoryEngine;
	};
};

export const metadata: ServiceMetadata = {
  "interfaceName": "StorageService",
  "serviceName": "storage",
  "filePath": "behemoth.ts",
  "methods": [
    {
      "name": "stat",
      "parameters": [],
      "returnType": "StorageMemoryStats",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "StorageMemoryStore",
      "kind": "type",
      "definition": "{\n\tname: string;\n\ttype: string;\n\tmemoryBytes: number;\n\tpageCacheBytes?: number;\n\tschemaBytes?: number;\n\tstatementBytes?: number;\n\tresidentBytes?: number;\n\tbufferPoolBytes?: number;\n}"
    },
    {
      "name": "StorageMemoryEngine",
      "kind": "type",
      "definition": "{\n\tmemoryBytes: number;\n\tstores: StorageMemoryStore[];\n}"
    },
    {
      "name": "StorageMemoryStats",
      "kind": "type",
      "definition": "{\n\tvalkey: {\n\t\tmemoryBytes: number;\n\t};\n\tengines: {\n\t\tsqlite: StorageMemoryEngine;\n\t\tlmdbx: StorageMemoryEngine;\n\t\tgraph: StorageMemoryEngine;\n\t};\n}"
    }
  ]
};

// Client interface
export interface StorageServiceClient {
  stat(): Promise<StorageMemoryStats>;
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function createStorageServiceClient(
  config: WebSocketClientConfig,
): StorageServiceClient {
  return createWebSocketClient<StorageServiceClient>(metadata, config);
}

export function createStorageServiceWebSocketClient(
  config: WebSocketClientConfig,
): StorageServiceClient {
  return createStorageServiceClient(config);
}
