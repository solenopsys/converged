import { SqlStore } from "back-core";
import {
  ChunkMetadataRepository,
  ChunkMetadataEntity,
  CompressionType,
} from "./entities";

export class ChunkMetadataService {
  private readonly repo: ChunkMetadataRepository;

  constructor(store: SqlStore) {
    this.repo = new ChunkMetadataRepository(store, "chunk_metadata", {
      primaryKey: "hash",
      extractKey: (chunk) => ({ hash: chunk.hash }),
      buildWhereCondition: (key) => ({ hash: key.hash }),
    });
  }

  async save(
    hash: string,
    size: number,
    originalSize: number,
    compression: CompressionType = "deflate",
    owner: string = "",
  ): Promise<void> {
    const existing = await this.repo.findById({ hash });
    if (existing) {
      // Увеличиваем счетчик ссылок
      await this.repo.update({ hash }, { refCount: existing.refCount + 1 });
    } else {
      await this.repo.create({
        hash,
        size,
        originalSize,
        compression,
        refCount: 1,
        owner,
        createdAt: new Date().toISOString(),
      });
    }
  }

  async get(hash: string): Promise<ChunkMetadataEntity | undefined> {
    return this.repo.findById({ hash });
  }

  async decrementRef(hash: string): Promise<boolean> {
    const existing = await this.repo.findById({ hash });
    if (!existing) return false;

    if (existing.refCount <= 1) {
      await this.repo.delete({ hash });
      return true; // можно удалить файл
    } else {
      await this.repo.update({ hash }, { refCount: existing.refCount - 1 });
      return false; // файл еще используется
    }
  }

  async delete(hash: string): Promise<boolean> {
    return this.repo.delete({ hash });
  }
}
