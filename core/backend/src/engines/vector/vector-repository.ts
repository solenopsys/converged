import {
  FindAllOptions,
  CursorOptions,
  PaginationResult,
  SearchOptions,
  SearchResult,
} from "./vector-types";
import {
  KeyVector,
  RepositoryVector,
  RepositorySchema,
} from "./vector-types";
import { VectorStore } from "./vector-store";

export class BaseRepositoryVector<K extends KeyVector, V>
  implements RepositoryVector<K, V>
{
  constructor(
    private vectorStore: VectorStore,
    private readonly tableName: string,
    private readonly schema: RepositorySchema<K, V>,
    private readonly vectorColumn: string,
  ) {}

  async findById(id: K): Promise<V | undefined> {
    const whereCondition = this.schema.buildWhereCondition(id);

    const query = this.vectorStore.applyWhereConditions(
      this.vectorStore.db.selectFrom(this.tableName).selectAll(),
      whereCondition,
    );

    return query.executeTakeFirst() as Promise<V | undefined>;
  }

  async findAll(options: FindAllOptions = {}): Promise<V[]> {
    const { limit = 100, offset = 0, orderBy = [] } = options;

    const query = orderBy.reduce(
      (q, { field, direction }) => q.orderBy(field, direction),
      this.vectorStore.db
        .selectFrom(this.tableName)
        .selectAll()
        .limit(limit)
        .offset(offset),
    );

    return query.execute() as Promise<V[]>;
  }

  async findWithCursor(
    options: CursorOptions<V>,
  ): Promise<PaginationResult<V>> {
    const { cursorField, cursor, limit = 20, direction = "desc" } = options;

    let query = this.vectorStore.db
      .selectFrom(this.tableName)
      .selectAll()
      .orderBy(cursorField as string, direction)
      .limit(limit + 1);

    if (cursor !== undefined) {
      const operator = direction === "desc" ? "<" : ">";
      query = query.where(cursorField as string, operator, cursor);
    }

    const results = (await query.execute()) as V[];
    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, -1) : results;
    const nextCursor = hasMore
      ? data[data.length - 1]?.[cursorField]
      : undefined;

    return { data, nextCursor, hasMore };
  }

  async count(): Promise<number> {
    const result = await this.vectorStore.db
      .selectFrom(this.tableName)
      .select(({ fn }) => fn.countAll().as("count"))
      .executeTakeFirst();

    return Number(result?.count || 0);
  }

  async create(entity: Omit<V, keyof K>): Promise<V> {
    const serialized = this.serializeDates(entity);

    const result = await this.vectorStore.db
      .insertInto(this.tableName)
      .values(serialized as any)
      .returningAll()
      .executeTakeFirstOrThrow();

    return result as V;
  }

  async update(id: K, entity: Partial<V>): Promise<V | undefined> {
    const whereCondition = this.schema.buildWhereCondition(id);

    const query = this.vectorStore.applyWhereConditions(
      this.vectorStore.db
        .updateTable(this.tableName)
        .set(entity as any)
        .returningAll(),
      whereCondition,
    );

    return query.executeTakeFirst() as Promise<V | undefined>;
  }

  async delete(id: K): Promise<boolean> {
    const whereCondition = this.schema.buildWhereCondition(id);

    const query = this.vectorStore.applyWhereConditions(
      this.vectorStore.db.deleteFrom(this.tableName),
      whereCondition,
    );

    const result = await query.executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }

  async search(
    vector: number[],
    options: SearchOptions = {},
  ): Promise<SearchResult<V>[]> {
    const { limit = 10, minScore } = options;

    const matches = this.vectorStore.searchByVector(
      this.tableName,
      this.vectorColumn,
      vector,
      minScore !== undefined ? limit * 2 : limit,
    );

    if (matches.length === 0) {
      return [];
    }

    const rowids = matches.map((m) => m.rowid);
    const distanceMap = new Map(matches.map((m) => [m.rowid, m.distance]));

    const entities = (await this.vectorStore.db
      .selectFrom(this.tableName)
      .selectAll()
      .where("rowid" as any, "in", rowids)
      .execute()) as Array<V & { rowid: number }>;

    let results: SearchResult<V>[] = entities.map((entity) => ({
      entity,
      score: 1 - (distanceMap.get((entity as any).rowid) ?? 1),
    }));

    if (minScore !== undefined) {
      results = results.filter((r) => r.score >= minScore);
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private serializeDates(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map((item) => this.serializeDates(item));
    if (typeof obj === "object") {
      const result: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          result[key] = this.serializeDates(obj[key]);
        }
      }
      return result;
    }
    return obj;
  }
}
