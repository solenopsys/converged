
import { SqlStore, newULID } from "back-core";
import { FileMetadataRepository, FileChunkRepository, FileMetadataEntity, FileChunkEntity, FileMetadataKey, FileChunkKey } from "./entities";
import { FileMetadata, FileChunk, UUID, HashString, PaginationParams, PaginatedResult } from "../../types";

export class MetadataStoreService {
    private readonly store: SqlStore;
    public readonly fileMetadataRepo: FileMetadataRepository;
    public readonly fileChunkRepo: FileChunkRepository;

    constructor(store: SqlStore) {
        this.store = store;
        this.fileMetadataRepo = new FileMetadataRepository(store, "file_metadata", {
            primaryKey: 'id',
            extractKey: (file) => ({ id: file.id }),
            buildWhereCondition: (key) => ({ id: key.id })
        });
        this.fileChunkRepo = new FileChunkRepository(store, "file_chunks", {
            primaryKey: ['fileId', 'chunkNumber'],
            extractKey: (chunk) => ({ fileId: chunk.fileId, chunkNumber: chunk.chunkNumber }),
            buildWhereCondition: (key) => ({ fileId: key.fileId, chunkNumber: key.chunkNumber })
        });
    }

    async save(file: FileMetadata): Promise<UUID> {

        const entity: FileMetadataEntity = { ...file };
        await this.fileMetadataRepo.create(entity);
        return file.id;
    }

    async saveChunk(chunk: FileChunk): Promise<HashString> {
        const entity: FileChunkEntity = { ...chunk };
        await this.fileChunkRepo.create(entity);
        return chunk.hash;
    }

    async update(id: UUID, file: FileMetadata): Promise<void> {
        const entity: FileMetadataEntity = { ...file, id };
        await this.fileMetadataRepo.update(entity);
    }

    async delete(id: UUID): Promise<void> {
        const key: FileMetadataKey = { id };
        await this.fileMetadataRepo.delete(key);
    }

    async get(id: UUID): Promise<FileMetadata | undefined> {
        console.log('key', id);
        const value = await this.fileMetadataRepo.findById({ id });
        console.log('value', value);
        return value;
    }


  async getChunks(id: UUID): Promise<FileChunk[]> {
    const rows = await this.store.db
      .selectFrom('file_chunks')
      .selectAll()
      .where('fileId', '=', id)
      .orderBy('chunkNumber', 'asc')
      .execute();

    return rows as FileChunk[];
  }


    async list(params: PaginationParams): Promise<PaginatedResult<FileMetadata>> {
        const items = await this.fileMetadataRepo.list(params);
        return {
            items: items.map(item => item as FileMetadata),
            totalCount: items.length
        };
    }

    async statistic(): Promise<any> {
        // This is a simplified implementation. A real implementation would query the database for stats.
        return {};
    }
}
