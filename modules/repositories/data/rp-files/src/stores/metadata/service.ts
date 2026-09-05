import {
	applyKyselyFilter,
	type KyselyFilterSchema,
	type SqlStore,
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
		column: "id",
	},
	name: {
		valueType: "string",
		operators: ["eq", "in", "contains", "startsWith"],
		column: "name",
	},
	fileType: {
		valueType: "string",
		operators: ["eq", "in", "contains", "startsWith"],
		column: "fileType",
	},
	owner: {
		valueType: "string",
		operators: ["eq", "in", "contains", "startsWith"],
		column: "owner",
	},
	status: {
		valueType: "string",
		operators: ["eq", "in", "notEq", "notIn"],
		column: "status",
	},
	fileSize: {
		valueType: "number",
		operators: ["eq", "gt", "gte", "lt", "lte", "between"],
		column: "fileSize",
	},
	createdAt: {
		valueType: "date",
		operators: ["gt", "gte", "lt", "lte", "between"],
		column: "createdAt",
	},
};

export class MetadataStoreService {
	private readonly store: SqlStore;
	public readonly fileMetadataRepo: FileMetadataRepository;
	public readonly fileChunkRepo: FileChunkRepository;
	public readonly fileCollectionRepo: FileCollectionRepository;

	constructor(store: SqlStore) {
		this.store = store;
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

	async save(file: FileMetadata): Promise<UUID> {
		const { createdAt, ...rest } = file as any;
		await this.fileMetadataRepo.create(rest);
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
		const key: FileMetadataKey = { id };
		await this.fileMetadataRepo.delete(key);
	}

	async get(id: UUID): Promise<FileMetadata | undefined> {
		return await this.fileMetadataRepo.findById({ id });
	}

	async getChunks(id: UUID): Promise<FileChunk[]> {
		const rows = await this.store.db
			.selectFrom("file_chunks")
			.selectAll()
			.where("fileId", "=", id)
			.orderBy("chunkNumber", "asc")
			.execute();

		return rows as FileChunk[];
	}

	async list(params: PaginationParams): Promise<PaginatedResult<FileMetadata>> {
		const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
		const offset = Math.max(params.offset ?? 0, 0);
		const key = params.key?.trim();

		let filesQuery = this.store.db.selectFrom("file_metadata").selectAll();
		let countQuery = this.store.db
			.selectFrom("file_metadata")
			.select(({ fn }) => fn.countAll().as("count"));

		if (key) {
			const pattern = `%${key}%`;
			const whereMatchesKey = (eb: any) =>
				eb.or([
					eb("name", "like", pattern),
					eb("fileType", "like", pattern),
					eb("owner", "like", pattern),
					eb("id", "like", pattern),
				]);

			filesQuery = filesQuery.where(whereMatchesKey);
			countQuery = countQuery.where(whereMatchesKey);
		}
		filesQuery = applyKyselyFilter(filesQuery, params.filter, fileFilterSchema);
		countQuery = applyKyselyFilter(countQuery, params.filter, fileFilterSchema);

		const [items, count] = await Promise.all([
			filesQuery
				.orderBy("createdAt", "desc")
				.limit(limit)
				.offset(offset)
				.execute(),
			countQuery.executeTakeFirst(),
		]);

		return {
			items: items.map((item) => item as FileMetadata),
			totalCount: Number(count?.count ?? 0),
		};
	}

	async statistic(): Promise<any> {
		return {};
	}

	async saveCollection(collection: FileCollection): Promise<UUID> {
		const { createdAt, ...rest } = collection as any;
		await this.fileCollectionRepo.create(rest);
		return collection.id;
	}

	async getCollection(id: UUID): Promise<FileCollection | undefined> {
		return await this.fileCollectionRepo.findById({ id });
	}

	async deleteCollection(id: UUID): Promise<void> {
		await this.fileCollectionRepo.delete({ id });
	}

	async listByCollection(collectionId: UUID): Promise<FileMetadata[]> {
		const rows = await this.store.db
			.selectFrom("file_metadata")
			.selectAll()
			.where("collectionId", "=", collectionId)
			.orderBy("createdAt", "asc")
			.execute();
		return rows as FileMetadata[];
	}
}
