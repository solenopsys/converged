import { BaseKeyJson, BaseRepositoryJson, JsonStore, generateULID } from "back-core";
import type { CronEntry, CronInput, CronListParams, PaginatedResult, CronUpdate } from "../types";

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

    const items = (await this.repo.listAll()).filter((entry) => !status || entry.status === status);

    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const paged = items.slice(offset, offset + limit);
    return {
      items: paged,
      totalCount: items.length,
    };
  }
}
