import { KVStore, generateULID } from "back-core";
import type { CronHistoryEntry, CronHistoryListParams, PaginatedResult } from "../types";

const HISTORY_PREFIX = "history";

export class HistoryStoreService {
  constructor(private readonly store: KVStore) {}

  record(entry: Omit<CronHistoryEntry, "id" | "firedAt">): CronHistoryEntry {
    const id = generateULID();
    const record: CronHistoryEntry = {
      ...entry,
      id,
      firedAt: new Date().toISOString(),
    };
    this.store.put([HISTORY_PREFIX, id], record);
    return record;
  }

  list(params: CronHistoryListParams): PaginatedResult<CronHistoryEntry> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const keys = this.store.getKeysWithPrefix([HISTORY_PREFIX]);
    const items: CronHistoryEntry[] = [];

    for (const key of keys) {
      const entry = this.store.getDirect(key);
      if (!entry) continue;
      if (params.cronId && entry.cronId !== params.cronId) continue;
      items.push(entry as CronHistoryEntry);
    }

    items.sort((a, b) => b.firedAt.localeCompare(a.firedAt));

    return {
      items: items.slice(offset, offset + limit),
      totalCount: items.length,
    };
  }
}
