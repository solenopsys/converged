import { SqlStore } from "back-core";
import type {
  PaginatedResult,
  ThreadInfo,
  ThreadKind,
  ThreadListParams,
  ThreadStats,
} from "g-threads";
import { ThreadIndexRepository } from "./entities";

const ALL_KINDS: ThreadKind[] = ["chat", "audio", "forum", "comment"];

function toInfo(row: any): ThreadInfo {
  return {
    threadId: row.threadId,
    kind: row.kind as ThreadKind,
    messageCount: Number(row.messageCount ?? 0),
    createdAt: Number(row.createdAt ?? 0),
    updatedAt: Number(row.updatedAt ?? 0),
  };
}

export class ThreadIndexStoreService {
  private readonly repo: ThreadIndexRepository;

  constructor(private store: SqlStore) {
    this.repo = new ThreadIndexRepository(store, "thread_index", {
      primaryKey: "threadId",
      extractKey: (e) => ({ threadId: e.threadId }),
      buildWhereCondition: (k) => ({ threadId: k.threadId }),
    });
  }

  // Set/override a thread's kind (idempotent). Creates the row if missing.
  async register(threadId: string, kind: ThreadKind): Promise<void> {
    const now = Date.now();
    const existing = await this.repo.findById({ threadId });
    const db = this.store.db as any;
    if (existing) {
      await db
        .updateTable("thread_index")
        .set({ kind, updatedAt: now })
        .where("threadId", "=", threadId)
        .execute();
    } else {
      await db
        .insertInto("thread_index")
        .values({ threadId, kind, messageCount: 0, createdAt: now, updatedAt: now })
        .execute();
    }
  }

  // Count one new message; create the row (default kind "chat") on first sight.
  async touch(threadId: string): Promise<void> {
    const now = Date.now();
    const existing = await this.repo.findById({ threadId });
    const db = this.store.db as any;
    if (existing) {
      await db
        .updateTable("thread_index")
        .set({ messageCount: Number(existing.messageCount ?? 0) + 1, updatedAt: now })
        .where("threadId", "=", threadId)
        .execute();
    } else {
      await db
        .insertInto("thread_index")
        .values({ threadId, kind: "chat", messageCount: 1, createdAt: now, updatedAt: now })
        .execute();
    }
  }

  async list(params: ThreadListParams): Promise<PaginatedResult<ThreadInfo>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;
    const db = this.store.db as any;

    let query = db.selectFrom("thread_index").selectAll();
    let countQuery = db
      .selectFrom("thread_index")
      .select((eb: any) => eb.fn.countAll().as("count"));
    if (params.kind) {
      query = query.where("kind", "=", params.kind);
      countQuery = countQuery.where("kind", "=", params.kind);
    }

    const rows = await query
      .orderBy("updatedAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();
    const counted = await countQuery.executeTakeFirst();

    return {
      items: rows.map(toInfo),
      totalCount: Number(counted?.count ?? 0),
    };
  }

  async stats(): Promise<ThreadStats> {
    const db = this.store.db as any;
    const rows = await db
      .selectFrom("thread_index")
      .select((eb: any) => [
        "kind",
        eb.fn.countAll().as("count"),
        eb.fn.sum("messageCount").as("messages"),
      ])
      .groupBy("kind")
      .execute();

    const byKind = Object.fromEntries(
      ALL_KINDS.map((k) => [k, 0]),
    ) as Record<ThreadKind, number>;
    let total = 0;
    let totalMessages = 0;

    for (const row of rows) {
      const kind = row.kind as ThreadKind;
      const count = Number(row.count ?? 0);
      if (kind in byKind) byKind[kind] = count;
      total += count;
      totalMessages += Number(row.messages ?? 0);
    }

    return { total, totalMessages, byKind };
  }
}
