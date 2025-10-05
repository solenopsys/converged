import { FindAllOptions, CursorOptions, PaginationResult } from "./sql-types";
import { KeySQL, RepositorySQL, RepositorySchema } from "./sql-types";
import { SqlStore } from "./sql-store";

export class BaseRepositorySQL<K extends KeySQL, V> implements RepositorySQL<K, V> {
  constructor(
    private sqlStore: SqlStore,
    private readonly tableName: string,
    private readonly schema: RepositorySchema<K, V>
  ) {
  }

  async findById(id: K): Promise<V | undefined> {
    const whereCondition = this.schema.buildWhereCondition(id);

    const query = this.sqlStore.applyWhereConditions(
      this.sqlStore.db.selectFrom(this.tableName).selectAll(),
      whereCondition
    );

    return query.executeTakeFirst() as Promise<V | undefined>;
  }

  async findAll(options: FindAllOptions = {}): Promise<V[]> {
    const { limit = 100, offset = 0, orderBy = [] } = options;

    const query = orderBy.reduce(
      (q, { field, direction }) => q.orderBy(field, direction),
      this.sqlStore.db
        .selectFrom(this.tableName)
        .selectAll()
        .limit(limit)
        .offset(offset)
    );

    return query.execute() as Promise<V[]>;
  }

  async findWithCursor(options: CursorOptions<V>): Promise<PaginationResult<V>> {
    const { cursorField, cursor, limit = 20, direction = 'desc' } = options;

    let query = this.sqlStore.db
      .selectFrom(this.tableName)
      .selectAll()
      .orderBy(cursorField as string, direction)
      .limit(limit + 1);

    if (cursor !== undefined) {
      const operator = direction === 'desc' ? '<' : '>';
      query = query.where(cursorField as string, operator, cursor);
    }

    const results = await query.execute() as V[];
    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, -1) : results;
    const nextCursor = hasMore ? data[data.length - 1]?.[cursorField] : undefined;

    return { data, nextCursor, hasMore };
  }

  async create(entity: Omit<V, keyof K>): Promise<V> {
    return this.sqlStore.db
      .insertInto(this.tableName)
      .values(entity as any)
      .returningAll()
      .executeTakeFirstOrThrow() as Promise<V>;
  }

  async update(id: K, entity: Partial<V>): Promise<V | undefined> {
    const whereCondition = this.schema.buildWhereCondition(id);

    const query = this.sqlStore.applyWhereConditions(
      this.sqlStore.db
        .updateTable(this.tableName)
        .set(entity as any)
        .returningAll(),
      whereCondition
    );

    return query.executeTakeFirst() as Promise<V | undefined>;
  }

  async delete(id: K): Promise<boolean> {
    const whereCondition = this.schema.buildWhereCondition(id);

    const query = this.sqlStore.applyWhereConditions(
      this.sqlStore.db.deleteFrom(this.tableName),
      whereCondition
    );

    const result = await query.executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }
}
