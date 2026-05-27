import type { FunctionsService, FunctionDef, FunctionInput, FunctionSearchResult, FunctionType } from "g-functions";
import { Access, Service } from "nrpc";
import { StoresController } from "./stores";
import {
  generateEmbedding,
  buildEmbeddingInput,
  cosineSimilarity,
} from "./embedding";

const MS_ID = "ms-functions";

@Service("functions")
class FunctionsServiceImpl implements FunctionsService {
  private stores: StoresController;
  private initPromise?: Promise<void>;
  // In-memory vector index: id → { contentHash, vector }
  private vectorIndex = new Map<string, { contentHash: string; vector: number[] }>();

  constructor() {
    this.init();
  }

  async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      this.stores = new StoresController(MS_ID);
      await this.stores.init();
      await this.rebuildVectorIndex();
    })();
    return this.initPromise;
  }

  private async ensureInit() {
    await this.init();
  }

  private async rebuildVectorIndex() {
    const functions = await this.stores.functions.list();
    this.vectorIndex.clear();
    for (const fn of functions) {
      const record = await this.stores.embeddings.get(fn.contentHash);
      if (record) {
        this.vectorIndex.set(fn.id, { contentHash: fn.contentHash, vector: record.vector });
      }
    }
  }

  private async ensureEmbedding(contentHash: string, brief: string, description: string): Promise<number[]> {
    const cached = await this.stores.embeddings.get(contentHash);
    if (cached) return cached.vector;

    const vector = await generateEmbedding(buildEmbeddingInput(brief, description));
    await this.stores.embeddings.save(contentHash, vector);
    return vector;
  }

  @Access("internal")
  async registerFunctions(functions: FunctionInput[]): Promise<void> {
    await this.ensureInit();
    for (const input of functions) {
      const { def, changed } = await this.stores.functions.upsert(input);
      if (changed || !this.vectorIndex.has(def.id)) {
        try {
          const vector = await this.ensureEmbedding(def.contentHash, def.brief, def.description);
          this.vectorIndex.set(def.id, { contentHash: def.contentHash, vector });
        } catch (err) {
          console.warn(`[ms-functions] Failed to generate embedding for ${def.id}:`, err);
        }
      }
    }
  }

  async listFunctions(type?: FunctionType, category?: string): Promise<FunctionDef[]> {
    await this.ensureInit();
    return this.stores.functions.list(type, category);
  }

  async getFunction(id: string): Promise<FunctionDef | null> {
    await this.ensureInit();
    return (await this.stores.functions.get(id)) ?? null;
  }

  async searchFunctions(query: string, limit = 10): Promise<FunctionSearchResult[]> {
    await this.ensureInit();

    if (this.vectorIndex.size === 0) {
      return this.textSearch(query, limit);
    }

    let queryVector: number[];
    try {
      queryVector = await generateEmbedding(query);
    } catch {
      return this.textSearch(query, limit);
    }

    const scored: Array<{ id: string; score: number }> = [];
    for (const [id, entry] of this.vectorIndex) {
      scored.push({ id, score: cosineSimilarity(queryVector, entry.vector) });
    }
    scored.sort((a, b) => b.score - a.score);

    const topIds = scored.slice(0, limit);
    const results: FunctionSearchResult[] = [];
    for (const { id, score } of topIds) {
      const fn = await this.stores.functions.get(id);
      if (fn) {
        results.push({ id: fn.id, brief: fn.brief, description: fn.description, category: fn.category, type: fn.type, score });
      }
    }
    return results;
  }

  // BM25-style text fallback when no embeddings are available
  private async textSearch(query: string, limit: number): Promise<FunctionSearchResult[]> {
    const all = await this.stores.functions.list();
    const q = query.toLowerCase();
    const scored = all
      .map((fn) => {
        const text = `${fn.id} ${fn.brief} ${fn.description} ${fn.category ?? ""}`.toLowerCase();
        const score = q.split(" ").filter(Boolean).reduce((acc, word) => acc + (text.includes(word) ? 1 : 0), 0) / (q.split(" ").length || 1);
        return { fn, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map(({ fn, score }) => ({
      id: fn.id, brief: fn.brief, description: fn.description,
      category: fn.category, type: fn.type, score,
    }));
  }

  @Access("internal")
  async deleteFunction(id: string): Promise<void> {
    await this.ensureInit();
    const fn = await this.stores.functions.get(id);
    if (fn) {
      this.vectorIndex.delete(id);
      await this.stores.functions.delete(id);
    }
  }
}

export default FunctionsServiceImpl;
