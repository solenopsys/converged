import { JsonStore, BaseRepositoryJson, BaseKeyJson } from "back-core";
import { EMBEDDING_MODEL, EMBEDDING_MODEL_VERSION } from "../../embedding";

export type EmbeddingRecord = {
  contentHash: string;
  model: string;
  modelVersion: string;
  vector: number[];
  generatedAt: number;
};

class EmbeddingKey extends BaseKeyJson {
  readonly type = "emb";
}

function embeddingKey(contentHash: string): string {
  return `${EMBEDDING_MODEL}:${contentHash}`;
}

class EmbeddingRepository extends BaseRepositoryJson<EmbeddingKey, EmbeddingRecord> {}

export class EmbeddingsStoreService {
  private readonly repo: EmbeddingRepository;

  constructor(store: JsonStore) {
    this.repo = new EmbeddingRepository(store);
  }

  async get(contentHash: string): Promise<EmbeddingRecord | undefined> {
    return this.repo.get(new EmbeddingKey(embeddingKey(contentHash)));
  }

  async save(contentHash: string, vector: number[]): Promise<void> {
    const record: EmbeddingRecord = {
      contentHash,
      model: EMBEDDING_MODEL,
      modelVersion: EMBEDDING_MODEL_VERSION,
      vector,
      generatedAt: Date.now(),
    };
    await this.repo.save(new EmbeddingKey(embeddingKey(contentHash)), record);
  }

  async listAll(): Promise<EmbeddingRecord[]> {
    return this.repo.listAll();
  }

  async delete(contentHash: string): Promise<void> {
    await this.repo.delete(new EmbeddingKey(embeddingKey(contentHash)));
  }
}
