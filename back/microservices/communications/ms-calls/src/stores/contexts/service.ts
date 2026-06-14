import { JsonStore, BaseKeyJson, BaseRepositoryJson } from "back-core";
import type {
  CallContext,
  CallContextInput,
  CallContextListParams,
  CallContextName,
  CallContextSummary,
  PaginatedResult,
} from "../../types";

/**
 * Call contexts — the system prompt + spoken language the llm-audio-gate loads
 * before answering a call. Stored as typed JSON entities (one per context name)
 * in the `llm-gate-configs` JSON store, which the gate reads directly by the
 * `llm-context/<name>.json` key this repository produces.
 *
 * Language lives in the context on purpose: the gate has no hardcoded language —
 * it takes it from here. A context with no instructions or no language is
 * invalid and the gate refuses the call rather than answering blind.
 */
class CallContextKey extends BaseKeyJson {
  readonly type = "llm-context";
}

class CallContextRepository extends BaseRepositoryJson<
  CallContextKey,
  CallContext
> {}

export class ContextStoreService {
  private readonly repo: CallContextRepository;

  constructor(store: JsonStore) {
    this.repo = new CallContextRepository(store);
  }

  async saveContext(
    name: CallContextName,
    input: CallContextInput,
  ): Promise<CallContextSummary> {
    const instructions = (input?.instructions ?? "").trim();
    const language = (input?.language ?? "").trim();
    if (!instructions) {
      throw new Error("context instructions are required");
    }
    if (!language) {
      throw new Error("context language is required");
    }

    const updatedAt = Date.now();
    const entity: CallContext = {
      id: name,
      name,
      updatedAt,
      instructions,
      language,
    };
    await this.repo.save(new CallContextKey(name), entity);

    return { id: name, name, updatedAt, language, size: instructions.length };
  }

  async getContext(name: CallContextName): Promise<CallContext | null> {
    return (await this.repo.get(new CallContextKey(name))) ?? null;
  }

  async listContexts(
    params: CallContextListParams,
  ): Promise<PaginatedResult<CallContextSummary>> {
    const all = await this.repo.listAll();
    const summaries: CallContextSummary[] = all
      .map((c) => ({
        id: c.id,
        name: c.name,
        updatedAt: c.updatedAt ?? 0,
        language: c.language,
        size: c.instructions?.length,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const offset = params.offset ?? 0;
    const limit = params.limit ?? summaries.length;

    return {
      items: summaries.slice(offset, offset + limit),
      totalCount: summaries.length,
    };
  }

  async deleteContext(name: CallContextName): Promise<boolean> {
    return this.repo.delete(new CallContextKey(name));
  }
}
