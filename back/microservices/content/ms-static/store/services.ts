import { KVStore, SqlStore } from "back-core";
import type {
  ListMetaParams,
  SetDataParams,
  SetMetaParams,
  SetStatusPatternParams,
  SetStatusPatternResult,
  StaticMeta,
  StaticStatus,
} from "../types";

type StaticMetaRow = StaticMeta;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function patternToLike(pattern: string): string {
  return pattern.replaceAll("*", "%");
}

export class MetaStoreService {
  private db: SqlStore["db"];

  constructor(store: SqlStore) {
    this.db = store.db;
  }

  async setMeta(params: SetMetaParams): Promise<StaticMeta> {
    const previous = await this.getMeta(params.id);
    const updatedAt = nowSeconds();
    const row: StaticMeta = {
      id: params.id,
      status: params.status ?? previous?.status ?? "todo",
      contentType: params.contentType,
      size: previous?.size ?? 0,
      loadedAt: previous?.loadedAt ?? null,
      updatedAt,
    };

    if (previous) {
      await this.db
        .updateTable("static_meta")
        .set(row)
        .where("id", "=", params.id)
        .execute();
    } else {
      await this.db.insertInto("static_meta").values(row).execute();
    }

    return row;
  }

  async setLoaded(params: SetDataParams): Promise<StaticMeta> {
    const loadedAt = nowSeconds();
    const row: StaticMeta = {
      id: params.id,
      status: "loaded",
      contentType: params.contentType,
      size: params.content.length,
      loadedAt,
      updatedAt: loadedAt,
    };

    const previous = await this.getMeta(params.id);
    if (previous) {
      await this.db
        .updateTable("static_meta")
        .set(row)
        .where("id", "=", params.id)
        .execute();
    } else {
      await this.db.insertInto("static_meta").values(row).execute();
    }

    return row;
  }

  async getMeta(id: string): Promise<StaticMeta | null> {
    const row = (await this.db
      .selectFrom("static_meta")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()) as StaticMetaRow | undefined;

    return row ?? null;
  }

  async listMeta(params: ListMetaParams): Promise<{ items: StaticMeta[]; totalCount: number }> {
    let query: any = this.db.selectFrom("static_meta").selectAll();
    let countQuery: any = this.db
      .selectFrom("static_meta")
      .select((eb: any) => eb.fn.countAll().as("count"));

    if (params.status) {
      query = query.where("status", "=", params.status);
      countQuery = countQuery.where("status", "=", params.status);
    }

    if (params.contentType) {
      query = query.where("contentType", "=", params.contentType);
      countQuery = countQuery.where("contentType", "=", params.contentType);
    }

    const search = params.search?.trim();
    if (search) {
      const pattern = `%${search}%`;
      query = query.where("id", "like", pattern);
      countQuery = countQuery.where("id", "like", pattern);
    }

    const [items, countRow] = await Promise.all([
      query
        .orderBy("updatedAt", "desc")
        .limit(params.limit)
        .offset(params.offset)
        .execute(),
      countQuery.executeTakeFirst(),
    ]);

    return {
      items: items as StaticMeta[],
      totalCount: Number(countRow?.count ?? 0),
    };
  }

  async getOneByStatus(status: StaticStatus): Promise<StaticMeta | null> {
    const row = (await this.db
      .selectFrom("static_meta")
      .selectAll()
      .where("status", "=", status)
      .orderBy("updatedAt", "asc")
      .limit(1)
      .executeTakeFirst()) as StaticMetaRow | undefined;

    return row ?? null;
  }

  async setStatus(id: string, status: StaticStatus): Promise<StaticMeta> {
    const previous = await this.getMeta(id);
    if (!previous) {
      throw new Error(`Static meta not found: ${id}`);
    }

    const row: StaticMeta = {
      ...previous,
      status,
      updatedAt: nowSeconds(),
    };

    await this.db
      .updateTable("static_meta")
      .set(row)
      .where("id", "=", id)
      .execute();

    return row;
  }

  async setStatusPattern(params: SetStatusPatternParams): Promise<SetStatusPatternResult> {
    const pattern = params.pattern.trim();
    if (!pattern) {
      return { updated: 0 };
    }

    const result = await this.db
      .updateTable("static_meta")
      .set({
        status: params.status,
        updatedAt: nowSeconds(),
      })
      .where("id", "like", patternToLike(pattern))
      .executeTakeFirst();

    return { updated: Number(result.numUpdatedRows ?? 0) };
  }

  async deleteMeta(id: string): Promise<void> {
    await this.db.deleteFrom("static_meta").where("id", "=", id).execute();
  }

  async listIds(): Promise<Set<string>> {
    const rows = (await this.db.selectFrom("static_meta").select("id").execute()) as Array<{
      id: string;
    }>;
    return new Set(rows.map((row) => row.id));
  }
}

export class ContentStoreService {
  constructor(private store: KVStore) {}

  getData(id: string): string | null {
    const value = this.store.get([id]);
    if (value === undefined) return null;
    if (Buffer.isBuffer(value)) return value.toString();
    return String(value);
  }

  setData(id: string, content: string): void {
    this.store.put([id], content);
  }

  deleteData(id: string): void {
    this.store.delete([id]);
  }

  listKeys(): string[] {
    return this.store.listKeys([]);
  }
}
