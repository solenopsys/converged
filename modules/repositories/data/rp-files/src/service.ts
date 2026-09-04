import { type CacheAdapter, createServerNrpcClientConfig } from "back-core";
import type {
	DetectTypeInput,
	ExtractTextInput,
	ExtractTextResult,
	FileChunk,
	FileCollection,
	FileMetadata,
	FilesService,
	FileTypeDetection,
	HashString,
	MaterializedFile,
	PaginatedResult,
	PaginationParams,
	PersistInput,
	UUID,
} from "g-files";
import { createStoreServiceClient } from "g-store";
import {
	concatBytes,
	contentTypeForName,
	DEFAULT_CHUNK_SIZE,
	decompressChunk,
	deflateChunk,
	detectFileType,
	hashBytes,
	readCacheRef,
	writeCacheRef,
} from "./blobs";
import { StoresController } from "./stores";
import { extractTextFromBytes } from "./text";

const REPOSITORY_ID = "rp-files";

export class FilesServiceImpl implements FilesService {
	stores: StoresController;
	initPromise: Promise<void>;
	private readonly cache?: CacheAdapter;

	constructor(config?: {
		cache?: CacheAdapter;
		valkey?: CacheAdapter;
	}) {
		this.cache = config?.cache ?? config?.valkey;
		this.initPromise = this.init();
	}

	async init() {
		this.stores = new StoresController(REPOSITORY_ID);
		await this.stores.init();
	}

	private requiredCache(): CacheAdapter {
		if (!this.cache) {
			throw new Error("rp-files blob methods require the Valkey cache adapter");
		}
		return this.cache;
	}

	async save(file: FileMetadata, _processId?: string): Promise<UUID> {
		const id = await this.stores.metadataService.save(file);
		return id;
	}
	saveChunk(chunk: FileChunk): Promise<HashString> {
		return this.stores.metadataService.saveChunk(chunk);
	}
	update(id: UUID, file: FileMetadata): Promise<void> {
		return this.stores.metadataService.update(id, file);
	}
	/** Drop the record and let go of its blocks. rp-store counts references, so
	 *  a block another file still holds survives; one nobody holds is freed —
	 *  which never happened while the bytes sat in a store nothing cleaned. */
	async delete(id: UUID): Promise<void> {
		const chunks = await this.stores.metadataService.getChunks(id);
		const store = this.store();
		for (const chunk of chunks) {
			await store.delete(chunk.hash).catch((error: unknown) => {
				console.warn(`[rp-files] releasing ${chunk.hash} failed`, error);
			});
		}
		return this.stores.metadataService.delete(id);
	}
	get(id: UUID): Promise<FileMetadata> {
		return this.stores.metadataService.get(id);
	}
	getChunks(id: UUID): Promise<FileChunk[]> {
		return this.stores.metadataService.getChunks(id);
	}
	list(params: PaginationParams): Promise<PaginatedResult<FileMetadata>> {
		return this.stores.metadataService.list(params);
	}
	statistic(): Promise<unknown> {
		return this.stores.metadataService.statistic();
	}
	saveCollection(collection: FileCollection): Promise<UUID> {
		return this.stores.metadataService.saveCollection(collection);
	}
	getCollection(id: UUID): Promise<FileCollection> {
		return this.stores.metadataService.getCollection(id);
	}
	deleteCollection(id: UUID): Promise<void> {
		return this.stores.metadataService.deleteCollection(id);
	}
	listByCollection(collectionId: UUID): Promise<FileMetadata[]> {
		return this.stores.metadataService.listByCollection(collectionId);
	}

	// ---- workflow contract (contract.md): bytes travel as CacheRef ----------

	/** Assemble a stored file's chunks into one Valkey blob. */
	async materialize(fileId: UUID): Promise<MaterializedFile> {
		const cache = this.requiredCache();
		const metadata = await this.stores.metadataService.get(fileId);
		if (!metadata) {
			throw new Error(`File metadata not found: ${fileId}`);
		}

		const chunks = await this.stores.metadataService.getChunks(fileId);
		if (!chunks.length && metadata.fileSize > 0) {
			throw new Error(`File has no chunks: ${fileId}`);
		}

		const ordered = [...chunks].sort(
			(left, right) => left.chunkNumber - right.chunkNumber,
		);
		const parts: Uint8Array[] = [];
		for (const chunk of ordered) {
			parts.push(await this.readChunk(cache, chunk.hash));
		}

		const ref = await writeCacheRef(
			cache,
			concatBytes(parts),
			"materialize",
			fileId,
		);
		return { ref, metadata };
	}

	/** One chunk's plain bytes, read from rp-store. */
	private async readChunk(
		cache: CacheAdapter,
		hash: string,
	): Promise<Uint8Array> {
		const stored = await this.store().getWithMeta(hash);
		const raw = await cache.getBytes(stored.dataRef.cacheKey);
		if (!raw) {
			throw new Error(`Cache entry not found: ${stored.dataRef.cacheKey}`);
		}
		return decompressChunk(raw, stored.compression);
	}

	/** The block store. Every byte of every file is there and nowhere else. */
	private store() {
		return createStoreServiceClient(createServerNrpcClientConfig());
	}

	/** Detect a staged blob's file type from its name and magic bytes. */
	async detectType(input: DetectTypeInput): Promise<FileTypeDetection> {
		const bytes = await readCacheRef(this.requiredCache(), input.ref);
		return detectFileType(input.name, bytes);
	}

	/** Chunk + register a staged blob as a new stored file. */
	async persist(input: PersistInput): Promise<FileMetadata> {
		const bytes = await readCacheRef(this.requiredCache(), input.ref);
		return this.persistBytes(bytes, input);
	}

	/** Plain text of a staged blob (xlsx/xlsm sheets, svg labels, otherwise the
	 *  decoded bytes). The sales-import workflow reads lead lists this way
	 *  instead of parsing spreadsheets in the VM. */
	async extractText(input: ExtractTextInput): Promise<ExtractTextResult> {
		const bytes = await readCacheRef(this.requiredCache(), input.ref);
		const text = extractTextFromBytes(input.name, bytes);
		const max = input.maxChars ?? 0;
		if (max > 0 && text.length > max) {
			return { text: text.slice(0, max), chars: text.length, truncated: true };
		}
		return { text, chars: text.length, truncated: false };
	}

	private async persistBytes(
		bytes: Uint8Array,
		input: Omit<PersistInput, "ref">,
	): Promise<FileMetadata> {
		const fileId = crypto.randomUUID();
		const chunksCount = Math.max(
			1,
			Math.ceil(bytes.length / DEFAULT_CHUNK_SIZE),
		);
		const createdAt = new Date().toISOString();

		const metadata: FileMetadata = {
			id: fileId,
			hash: hashBytes(bytes),
			status: "uploaded",
			name: input.name,
			fileSize: bytes.length,
			fileType: input.fileType || contentTypeForName(input.name),
			compression: "deflate",
			owner: input.owner,
			createdAt,
			chunksCount,
			...(input.collectionId ? { collectionId: input.collectionId } : {}),
		};

		await this.save(metadata, input.processId);

		// Chunks go to rp-store, the same place an upload puts them: one
		// content-addressed home, deduplicated by hash and reference counted.
		const cache = this.requiredCache();
		const store = this.store();
		for (let index = 0; index < chunksCount; index++) {
			const start = index * DEFAULT_CHUNK_SIZE;
			const end = Math.min(start + DEFAULT_CHUNK_SIZE, bytes.length);
			const part = bytes.slice(start, end);
			const compressed = deflateChunk(part);
			const ref = await writeCacheRef(cache, compressed, "persist", fileId);
			const hash = await store.save(
				ref,
				part.length,
				"deflate",
				input.owner ?? "",
			);
			const chunkSize = compressed.length;
			await this.saveChunk({
				fileId,
				hash,
				chunkNumber: index,
				chunkSize,
				createdAt,
			});
		}

		return metadata;
	}
}
