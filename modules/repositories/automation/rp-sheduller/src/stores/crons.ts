import { BaseKeyJson, BaseRepositoryJson, createJsonFilterAdapter, JsonStore, generateULID } from "back-core";
import type { CronEntry, CronInput, CronListParams, PaginatedResult, CronUpdate } from "../types";

const cronFilters = createJsonFilterAdapter<CronEntry>({
  id: { valueType: "string", operators: ["eq", "in"] },
  name: { valueType: "string", operators: ["eq", "in", "contains", "startsWith"] },
  expression: { valueType: "string", operators: ["eq", "contains", "startsWith"] },
  provider: { valueType: "string", operators: ["eq", "in", "notEq", "notIn"] },
  action: { valueType: "string", operators: ["eq", "in", "notEq", "notIn"] },
  status: { valueType: "string", operators: ["eq", "in", "notEq", "notIn"] },
  createdAt: { valueType: "date", operators: ["gt", "gte", "lt", "lte", "between"] },
});

class CronKey extends BaseKeyJson {
  readonly type = "cron";
}

class CronsRepository extends BaseRepositoryJson<CronKey, CronEntry> {}

export class CronsStoreService {
  private readonly repo: CronsRepository;

  constructor(store: JsonStore) {
    this.repo = new CronsRepository(store);
  }

  async create(input: CronInput): Promise<CronEntry> {
    const id = generateULID();
    const now = new Date().toISOString();
    const entry: CronEntry = {
      id,
      name: input.name,
      expression: input.expression,
      provider: input.provider,
      action: input.action,
      params: input.params,
      providerSettings: input.providerSettings,
      status: input.status ?? "active",
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.save(new CronKey(id), entry);
    return entry;
  }

  async update(id: string, updates: CronUpdate): Promise<CronEntry | null> {
    const existing = await this.get(id);
    if (!existing) {
      return null;
    }
    const updated: CronEntry = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.repo.save(new CronKey(id), updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.get(id);
    if (!existing) {
      return false;
    }
    return this.repo.delete(new CronKey(id));
  }

  async get(id: string): Promise<CronEntry | null> {
    const entry = await this.repo.get(new CronKey(id));
    return entry ?? null;
  }

  async list(params: CronListParams): Promise<PaginatedResult<CronEntry>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;
    const status = params.status;

    const predicate = cronFilters.predicate(params.filter);
    const items = (await this.repo.listAll()).filter((entry) =>
      (!status || entry.status === status) && predicate(entry),
    );

    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const paged = items.slice(offset, offset + limit);
    return {
      items: paged,
      totalCount: items.length,
    };
  }

  async count(filter?: Record<string, unknown>): Promise<number> {
    return (await this.repo.listAll()).filter(cronFilters.predicate(filter)).length;
  }
}
