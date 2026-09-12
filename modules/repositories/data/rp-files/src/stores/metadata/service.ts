import {
	AccessTags,
	applyKyselyFilter,
	type KyselyFilterSchema,
	type SqlStore,
	visibleFrom,
} from "back-core";
import type {
	FileChunk,
	FileCollection,
	FileMetadata,
	HashString,
	PaginatedResult,
	PaginationParams,
	UUID,
} from "../../types";
import {
	FileChunkKey,
	FileChunkRepository,
	FileCollectionKey,
	FileCollectionRepository,
	type FileMetadataKey,
	FileMetadataRepository,
} from "./entities";

const fileFilterSchema: KyselyFilterSchema = {
	id: {
		valueType: "string",
		operators: ["eq", "in", "contains", "startsWith"],
		column: "obj.id",
	},
	name: {
		valueType: "string",
		operators: ["eq", "in", "contains", "startsWith"],
		column: "obj.name",
	},
	fileType: {
		valueType: "string",
		operators: ["eq", "in", "contains", "startsWith"],
		column: "obj.fileType",
	},
	owner: {
		valueType: "string",
		operators: ["eq", "in", "contains", "startsWith"],
		column: "obj.owner",
	},
	status: {
		valueType: "string",
		operators: ["eq", "in", "notEq", "notIn"],
		column: "obj.status",
	},
	fileSize: {
		valueType: "number",
		operators: ["eq", "gt", "gte", "lt", "lte", "between"],
		column: "obj.fileSize",
	},
	createdAt: {
		valueType: "date",
		operators: ["gt", "gte", "lt", "lte", "between"],
		column: "obj.createdAt",
	},
};

export class MetadataStoreService {
	private readonly store: SqlStore;
	/**
	 * Who may see which file record.
	 *
	 * The bytes are not here — they live in `rp-store`, content-addressed by
	 * hash — so this record is what access to a file actually means. Per
	 * `access-control.md` a file store keeps no tags of its own: the name is the
	 * object id, and the record pointing at it is what carries the decision.
	 */
	public readonly access: AccessTags;
	public readonly fileMetadataRepo: FileMetadataRepository;
	public readonly fileChunkRepo: FileChunkRepository;
	public readonly fileCollectionRepo: FileCollectionRepository;

	constructor(store: SqlStore) {
		this.store = store;
		this.access = new AccessTags(store);
		this.fileMetadataRepo = new FileMetadataRepository(store, "file_metadata", {
			primaryKey: "id",
			extractKey: (file) => ({ id: file.id }),
			buildWhereCondition: (key) => ({ id: key.id }),
		});
		this.fileChunkRepo = new FileChunkRepository(store, "file_chunks", {
			primaryKey: ["fileId", "chunkNumber"],
			extractKey: (chunk) => ({
				fileId: chunk.fileId,
				chunkNumber: chunk.chunkNumber,
			}),
			buildWhereCondition: (key) => ({
				fileId: key.fileId,
				chunkNumber: key.chunkNumber,
			}),
		});
		this.fileCollectionRepo = new FileCollectionRepository(
			store,
			"file_collections",
			{
				primaryKey: "id",
				extractKey: (col) => ({ id: col.id }),
				buildWhereCondition: (key) => ({ id: key.id }),
			},
		);
	}

	/**
	 * Records a file and tags it to its owner.
	 *
	 * The owner is settled by the caller in `service.ts` — from the token for a
	 * person, from the input only when a trusted service is filing on somebody's
	 * behalf — so by the time it reaches here it is already the truth.
	 */
	async save(file: FileMetadata): Promise<UUID> {
		const { createdAt, ...rest } = file as any;
		await this.fileMetadataRepo.create(rest);
		await this.access.tagNew(file.id, {
			visibility: "private",
			owner: file.owner,
		});
		return file.id;
	}

	async saveChunk(chunk: FileChunk): Promise<HashString> {
		const { createdAt, ...rest } = chunk as any;

		if (!rest.hash) {
			console.error("[MetadataStoreService] ERROR: hash is missing!", {
				chunk,
				rest,
			});
			throw new Error(
				`Cannot save chunk: hash is missing. Chunk: ${JSON.stringify(chunk)}`,
			);
		}

		await this.fileChunkRepo.create(rest);
		return chunk.hash;
	}

	async update(id: UUID, file: Partial<FileMetadata>): Promise<void> {
		await this.access.requireWrite(id);
		const key: FileMetadataKey = { id };

		// Filter out undefined, null, objects, arrays - keep only primitives
		const sanitized: Partial<FileMetadata> = {};
		for (const [key, value] of Object.entries(file)) {
			if (value !== undefined && value !== null) {
				const valueType = typeof value;
				// Only allow string, number, boolean, bigint
				if (
					valueType === "string" ||
					valueType === "number" ||
					valueType === "boolean" ||
					valueType === "bigint"
				) {
					(sanitized as any)[key] = value;
				} else if (value instanceof Date) {
					(sanitized as any)[key] = value.toISOString();
				}
			}
		}

		await this.fileMetadataRepo.update(key, sanitized);
	}

	async delete(id: UUID): Promise<void> {
		await this.access.requireWrite(id);
		const key: FileMetadataKey = { id };
		await this.fileMetadataRepo.delete(key);
		await this.access.dropObject(id);
	}

	/** A file the caller holds no tag for reads as absent, not as forbidden. */
	async get(id: UUID): Promise<FileMetadata | undefined> {
		if (!(await this.access.canRead(id))) return undefined;
		return await this.fileMetadataRepo.findById({ id });
	}

	/**
	 * A file's chunk list. Guarded by the file: a chunk hash is a key into
	 * `rp-store`, so handing the list out is handing out the bytes.
	 */
	async getChunks(id: UUID): Promise<FileChunk[]> {
		await this.access.requireRead(id);
		const rows = await this.store.db
			.selectFrom("file_chunks")
			.selectAll()
			.where("fileId", "=", id)
			.orderBy("chunkNumber", "asc")
			.execute();

		return rows as FileChunk[];
	}

	/**
	 * The caller's files, narrowed by tag before the search text is applied.
	 *
	 * The `key` search used to run across every record in the store, including
	 * the `owner` column — so typing somebody's name listed their files. Access
	 * comes first now, and the search only ever shrinks what was already open.
	 */
	private visible(params: {
		key?: string;
		filter?: PaginationParams["filter"];
	}) {
		let query = visibleFrom(this.store.db, "file_metadata");

		const key = params.key?.trim();
		if (key) {
			const pattern = `%${key}%`;
			query = query.where((eb: any) =>
				eb.or([
					eb("obj.name", "like", pattern),
					eb("obj.fileType", "like", pattern),
					eb("obj.owner", "like", pattern),
					eb("obj.id", "like", pattern),
				]),
			);
		}

		return applyKyselyFilter(query, params.filter, fileFilterSchema);
	}

	async list(params: PaginationParams): Promise<PaginatedResult<FileMetadata>> {
		const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
		const offset = Math.max(params.offset ?? 0, 0);

		const [items, count] = await Promise.all([
			this.visible(params)
				.selectAll("obj")
				.orderBy("obj.createdAt", "desc")
				.limit(limit)
				.offset(offset)
				.execute(),
			this.visible(params)
				.select((eb: any) => eb.fn.countAll().as("count"))
				.executeTakeFirst(),
		]);

		return {
			items: items.map((item: unknown) => item as FileMetadata),
			totalCount: Number(count?.count ?? 0),
		};
	}

	async statistic(): Promise<any> {
		return {};
	}

	async saveCollection(collection: FileCollection): Promise<UUID> {
		const { createdAt, ...rest } = collection as any;
		await this.fileCollectionRepo.create(rest);
		await this.access.tagNew(collection.id, {
			visibility: "private",
			owner: collection.owner,
		});
		return collection.id;
	}

	async getCollection(id: UUID): Promise<FileCollection | undefined> {
		if (!(await this.access.canRead(id))) return undefined;
		return await this.fileCollectionRepo.findById({ id });
	}

	async deleteCollection(id: UUID): Promise<void> {
		await this.access.requireWrite(id);
		await this.fileCollectionRepo.delete({ id });
		await this.access.dropObject(id);
	}

	/**
	 * Files in a collection, narrowed twice over: the collection has to be open
	 * to the caller, and then only the files that are open to them come back. A
	 * collection is a grouping, not a grant.
	 */
	async listByCollection(collectionId: UUID): Promise<FileMetadata[]> {
		await this.access.requireRead(collectionId);
		const rows = await visibleFrom(this.store.db, "file_metadata")
			.selectAll("obj")
			.where("obj.collectionId", "=", collectionId)
			.orderBy("obj.createdAt", "asc")
			.execute();
		return rows as FileMetadata[];
	}
}
