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

/** Memory statistics exposed by Behemoth's `storage` NRPC service. */
export interface StorageService {
	stat(): Promise<StorageMemoryStats>;
}
