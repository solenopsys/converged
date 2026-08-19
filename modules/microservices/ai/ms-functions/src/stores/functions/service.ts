import { JsonStore, BaseRepositoryJson, BaseKeyJson } from "back-core";
import type { FunctionDef, FunctionInput, FunctionType } from "g-functions";
import { contentHash, buildEmbeddingInput } from "../../embedding";

class FunctionKey extends BaseKeyJson {
  readonly type = "fn";
}

class FunctionRepository extends BaseRepositoryJson<FunctionKey, FunctionDef> {}

export class FunctionsStoreService {
  private readonly repo: FunctionRepository;

  constructor(store: JsonStore) {
    this.repo = new FunctionRepository(store);
  }

  async upsert(input: FunctionInput): Promise<{ def: FunctionDef; changed: boolean }> {
    const hash = contentHash(buildEmbeddingInput(input.brief, input.description));
    const existing = await this.repo.get(new FunctionKey(input.id));
    const now = Date.now();

    if (existing && existing.contentHash === hash) {
      return { def: existing, changed: false };
    }

    const def: FunctionDef = {
      ...input,
      contentHash: hash,
      registeredAt: existing?.registeredAt ?? now,
      updatedAt: now,
    };

    await this.repo.save(new FunctionKey(input.id), def);
    return { def, changed: true };
  }

  async get(id: string): Promise<FunctionDef | undefined> {
    return this.repo.get(new FunctionKey(id));
  }

  async list(type?: FunctionType, category?: string): Promise<FunctionDef[]> {
    const all = await this.repo.listAll();
    return all.filter(
      (fn) =>
        (!type || fn.type === type) &&
        (!category || fn.category === category),
    );
  }

  async delete(id: string): Promise<boolean> {
    return this.repo.delete(new FunctionKey(id));
  }
}
