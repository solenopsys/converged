import { SqlStore } from "back-core";
import {
  FileMetadataRepository,
  FileChunkRepository,
  FileMetadataEntity,
  FileChunkEntity,
  FileMetadataKey,
  FileChunkKey,
} from "./entities";
import {
  FileMetadata,
  FileChunk,
  UUID,
  HashString,
  PaginationParams,
  PaginatedResult,
} from "../../types";

export class MetadataStoreService {
  private readonly store: SqlStore;
  public readonly fileMetadataRepo: FileMetadataRepository;
  public readonly fileChunkRepo: FileChunkRepository;

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
  }

  async save(file: FileMetadata): Promise<UUID> {
    const { createdAt, ...rest } = file as any;
    await this.fileMetadataRepo.create(rest);
    return file.id;
  }

  async saveChunk(chunk: FileChunk): Promise<HashString> {
    const { createdAt, ...rest } = chunk as any;

    if (!rest.hash) {
      console.error('[MetadataStoreService] ERROR: hash is missing!', { chunk, rest });
      throw new Error(`Cannot save chunk: hash is missing. Chunk: ${JSON.stringify(chunk)}`);
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
    const items = await this.fileMetadataRepo.list(params);
    return {
      items: items.map((item) => item as FileMetadata),
      totalCount: items.length,
    };
  }

  async statistic(): Promise<any> {
    // This is a simplified implementation. A real implementation would query the database for stats.
    return {};
  }
}
