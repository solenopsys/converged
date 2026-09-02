import {
	CacheRef,
	HashString,
	PaginatedResult,
	PaginationParams,
	StoreService,
	CompressionType,
} from "g-store";
import { Access } from "nrpc";
import { StoresController } from "./stores";
import * as path from "path";
import { CACHE_BLOB_TTL_SECONDS, type CacheAdapter } from "back-core";

const MS_ID = "store-ms";

type ChunkMetadata = {
	compression: CompressionType;
	originalSize: number;
};

export class StoreServiceImpl implements StoreService {
	stores!: StoresController;
	private initPromise?: Promise<void>;
	private readonly cache?: CacheAdapter;

	constructor(config?: { cache?: CacheAdapter; valkey?: CacheAdapter }) {
		this.cache = config?.cache ?? config?.valkey;
		this.init();
	}

	async init() {
		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = (async () => {
			this.stores = new StoresController(MS_ID);
			await this.stores.init();
		})();

		return this.initPromise;
	}

	private buildHash(data: Uint8Array): HashString {
		// Use SHA-256 for cryptographic hash
		const hasher = new Bun.CryptoHasher("sha256");
		hasher.update(data);
		return hasher.digest("hex");
	}

	private toKey(hash: HashString): string {
		const prefix = hash.slice(0, 3);
		return path.join(prefix, hash);
	}

	private requiredCache(): CacheAdapter {
		if (!this.cache) {
			throw new Error(
				"Valkey cache is required for ms-store binary payload transfer",
			);
		}
		return this.cache;
	}

	private async readCacheRef(dataRef: CacheRef): Promise<Uint8Array> {
		const cache = this.requiredCache();
		if (!dataRef?.cacheKey) {
			throw new Error("Cache reference is required");
		}
		const data = await cache.getBytes(dataRef.cacheKey);
		if (!data) {
			throw new Error(`Cache entry not found: ${dataRef.cacheKey}`);
		}
		return data;
	}

	/** The file store materializes the blob into scoped Valkey and hands back the
	 * key; the stored size comes from chunk metadata. Bytes never enter this
	 * service — callers read them from Valkey by reference. */
	private async readChunkRef(
		hash: HashString,
	): Promise<{ ref: CacheRef; meta: ChunkMetadata }> {
		const stored = await this.stores.fileStore.get(this.toKey(hash));
		if (!stored) {
			throw new Error(`Chunk not found: ${hash}`);
		}
		const meta = await this.stores.metadataService.get(hash);
		return {
			ref: { cacheKey: stored.cacheKey, sizeBytes: meta?.size ?? 0 },
			meta: {
				compression: meta?.compression ?? "none",
				originalSize: meta?.originalSize ?? meta?.size ?? 0,
			},
		};
	}

	@Access("public")
	async save(
		dataRef: CacheRef,
		originalSize?: number,
		compression?: CompressionType,
		owner?: string,
	): Promise<HashString> {
		const data = await this.readCacheRef(dataRef);
		const hash = this.buildHash(data);
		await this.stores.fileStore.put(this.toKey(hash), data);
		await this.stores.metadataService.save(
			hash,
			data.length,
			originalSize ?? data.length,
			compression ?? "none",
			owner ?? "",
		);
		return hash;
	}

	@Access("public")
	async saveWithHash(
		hash: HashString,
		dataRef: CacheRef,
		originalSize?: number,
		compression?: CompressionType,
		owner?: string,
	): Promise<HashString> {
		const data = await this.readCacheRef(dataRef);
		await this.stores.fileStore.put(this.toKey(hash), data);
		await this.stores.metadataService.save(
			hash,
			data.length,
			originalSize ?? data.length,
			compression ?? "none",
			owner ?? "",
		);
		return hash;
	}

	async delete(hash: HashString): Promise<void> {

		const shouldDelete = await this.stores.metadataService.decrementRef(hash);
		if (shouldDelete) {
			await this.stores.fileStore.delete(this.toKey(hash));
		}
	}

	@Access("public")
	async get(hash: HashString): Promise<CacheRef> {
		return (await this.readChunkRef(hash)).ref;
	}

	@Access("public")
	async getWithMeta(hash: HashString): Promise<{
		dataRef: CacheRef;
		compression: CompressionType;
		originalSize: number;
	}> {
		const { ref, meta } = await this.readChunkRef(hash);
		return {
			dataRef: ref,
			compression: meta.compression,
			originalSize: meta.originalSize,
		};
	}

	@Access("public")
	async exists(hash: HashString): Promise<boolean> {
		return this.stores.fileStore.exists(this.toKey(hash));
	}

	async list(params: PaginationParams): Promise<PaginatedResult<HashString>> {
		const allKeys = await this.stores.fileStore.listKeys();
		const start = params.offset;
		const end = params.offset + params.limit;
		return {
			items: allKeys.slice(start, end).map((key) => path.basename(key)),
			totalCount: allKeys.length,
		};
	}

	async storeStatistic(): Promise<any> {
		return this.stores.fileStore.getStats();
	}
}
