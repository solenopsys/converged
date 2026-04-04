import { KVStore, generateULID } from "back-core";
import type { CronEntry, CronInput, CronListParams, CronStatus, PaginatedResult, CronUpdate } from "../types";

const CRON_PREFIX = "cron";

export class CronsStoreService {
  constructor(private readonly store: KVStore) {}

  create(input: CronInput): CronEntry {
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
    this.store.put([CRON_PREFIX, id], entry);
    return entry;
  }

  update(id: string, updates: CronUpdate): CronEntry | null {
    const existing = this.get(id);
    if (!existing) {
      return null;
    }
    const updated: CronEntry = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.store.put([CRON_PREFIX, id], updated);
    return updated;
  }

  delete(id: string): boolean {
    const existing = this.get(id);
    if (!existing) {
      return false;
    }
    this.store.delete([CRON_PREFIX, id]);
    return true;
  }

  get(id: string): CronEntry | null {
    const entry = this.store.get([CRON_PREFIX, id]);
    return entry ?? null;
  }

  list(params: CronListParams): PaginatedResult<CronEntry> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;
    const status = params.status;

    const keys = this.store.getKeysWithPrefix([CRON_PREFIX]);
    const items: CronEntry[] = [];

    for (const key of keys) {
      const entry = this.store.getDirect(key);
      if (!entry) {
        continue;
      }
      if (status && entry.status !== status) {
        continue;
      }
      items.push(entry as CronEntry);
    }

    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const paged = items.slice(offset, offset + limit);
    return {
      items: paged,
      totalCount: items.length,
    };
  }
}
