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

export type ProcessMemoryStats = {
	rssBytes: number;
	pssBytes: number;
	pssAnonBytes: number;
	pssFileBytes: number;
	pssShmemBytes: number;
	privateBytes: number;
	sharedBytes: number;
	swapBytes: number;
	unattributedRssBytes: number;
};

export type CgroupMemoryStats = {
	currentBytes: number;
	workingSetBytes: number;
	limitBytes: number | null;
	anonBytes: number;
	fileBytes: number;
	kernelBytes: number;
	kernelStackBytes: number;
	pageTablesBytes: number;
	percpuBytes: number;
	socketBytes: number;
	slabBytes: number;
	slabReclaimableBytes: number;
	slabUnreclaimableBytes: number;
	inactiveFileBytes: number;
	activeFileBytes: number;
};

export type RuntimeMemoryStats = {
	engineAttributedBytes: number;
	process?: ProcessMemoryStats;
	cgroup?: CgroupMemoryStats;
};

export type StorageMemoryStats = {
	memory: RuntimeMemoryStats;
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
      "name": "ProcessMemoryStats",
      "kind": "type",
      "definition": "{\n\trssBytes: number;\n\tpssBytes: number;\n\tpssAnonBytes: number;\n\tpssFileBytes: number;\n\tpssShmemBytes: number;\n\tprivateBytes: number;\n\tsharedBytes: number;\n\tswapBytes: number;\n\tunattributedRssBytes: number;\n}"
    },
    {
      "name": "CgroupMemoryStats",
      "kind": "type",
      "definition": "{\n\tcurrentBytes: number;\n\tworkingSetBytes: number;\n\tlimitBytes: number | null;\n\tanonBytes: number;\n\tfileBytes: number;\n\tkernelBytes: number;\n\tkernelStackBytes: number;\n\tpageTablesBytes: number;\n\tpercpuBytes: number;\n\tsocketBytes: number;\n\tslabBytes: number;\n\tslabReclaimableBytes: number;\n\tslabUnreclaimableBytes: number;\n\tinactiveFileBytes: number;\n\tactiveFileBytes: number;\n}"
    },
    {
      "name": "RuntimeMemoryStats",
      "kind": "type",
      "definition": "{\n\tengineAttributedBytes: number;\n\tprocess?: ProcessMemoryStats;\n\tcgroup?: CgroupMemoryStats;\n}"
    },
    {
      "name": "StorageMemoryStats",
      "kind": "type",
      "definition": "{\n\tmemory: RuntimeMemoryStats;\n\tvalkey: {\n\t\tmemoryBytes: number;\n\t};\n\tengines: {\n\t\tsqlite: StorageMemoryEngine;\n\t\tlmdbx: StorageMemoryEngine;\n\t\tgraph: StorageMemoryEngine;\n\t};\n}"
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
