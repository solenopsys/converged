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

/** Memory statistics exposed by Behemoth's `storage` NRPC service. */
export interface StorageService {
	stat(): Promise<StorageMemoryStats>;
}
