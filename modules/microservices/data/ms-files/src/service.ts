import type { CacheAdapter } from "back-core";
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
import {
	concatBytes,
	contentTypeForName,
	DEFAULT_CHUNK_SIZE,
	detectFileType,
	hashBytes,
	readCacheRef,
	readChunkBytes,
	saveChunkBytes,
	writeCacheRef,
} from "./blobs";
import { StoresController } from "./stores";
import { extractTextFromBytes } from "./text";

const MS_ID = "files-ms";

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
		this.stores = new StoresController(MS_ID);
		await this.stores.init();
	}

	private requiredCache(): CacheAdapter {
		if (!this.cache) {
			throw new Error("ms-files blob methods require the Valkey cache adapter");
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
	delete(id: UUID): Promise<void> {
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
			parts.push(await readChunkBytes(this.stores.chunkStore, chunk.hash));
		}

		const ref = await writeCacheRef(
			cache,
			concatBytes(parts),
			"materialize",
			fileId,
		);
		return { ref, metadata };
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

		for (let index = 0; index < chunksCount; index++) {
			const start = index * DEFAULT_CHUNK_SIZE;
			const end = Math.min(start + DEFAULT_CHUNK_SIZE, bytes.length);
			const { hash, chunkSize } = await saveChunkBytes(
				this.stores.chunkStore,
				bytes.slice(start, end),
			);
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
