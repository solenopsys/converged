import { Kysely, SelectQueryBuilder, UpdateQueryBuilder, DeleteQueryBuilder } from "kysely";
import { Store } from "../../stores/create";



export interface KeySQL {
  [key: string]: any;
}

// Базовая обертка вокруг Kysely
export class SqlStore<DB = any> implements Store {
  constructor(protected readonly kysely: Kysely<DB>) {}

  // Применяет WHERE условия через reduce
  protected applyWhereConditions<T extends string>(
    query: SelectQueryBuilder<DB, T, any> | UpdateQueryBuilder<DB, T, any> | DeleteQueryBuilder<DB, T, any>,
    conditions: Record<string, any>
  ) {
    return Object.entries(conditions).reduce(
      (q, [key, value]) => q.where(key, '=', value),
      query
    );
  }

  // Доступ к оригинальному Kysely если нужно
  get db() {
    return this.kysely;
  }
}

// Базовые интерфейсы
interface FindAllOptions {
  limit?: number;
  offset?: number;
  orderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
}

interface CursorOptions<V> {
  cursorField: keyof V;
  cursor?: any;
  limit?: number;
  direction?: 'asc' | 'desc';
}

interface PaginationResult<V> {
  data: V[];
  nextCursor?: any;
  hasMore: boolean;
}

interface RepositorySchema<K extends KeySQL, V> {
  primaryKey: keyof V | Array<keyof V>;
  extractKey: (entity: V) => K;
  buildWhereCondition: (key: K) => Record<string, any>;
}

import { Entity } from "../../types";

export interface RepositorySQL<K extends KeySQL, V extends Entity> {
  findById(id: K): Promise<V | undefined>;
  findAll(options?: FindAllOptions): Promise<V[]>;
  findWithCursor(options: CursorOptions<V>): Promise<PaginationResult<V>>;
  create(entity: Omit<V, keyof K>): Promise<V>;
  update(id: K, entity: Partial<V>): Promise<V | undefined>;
  delete(id: K): Promise<boolean>;
}

// Реализация репозитория
export class BasicRepository<K extends KeySQL, V extends Entity> extends BaseDB implements RepositorySQL<K, V> {
  constructor(
    kysely: Kysely<any>,
    private readonly tableName: string,
    private readonly schema: RepositorySchema<K, V>
  ) {
    super(kysely);
  }

  async findById(id: K): Promise<V | undefined> {
    const whereCondition = this.schema.buildWhereCondition(id);
    
    const query = this.applyWhereConditions(
      this.kysely.selectFrom(this.tableName).selectAll(),
      whereCondition
    );
    
    return query.executeTakeFirst() as Promise<V | undefined>;
  }

  async findAll(options: FindAllOptions = {}): Promise<V[]> {
    const { limit = 100, offset = 0, orderBy = [] } = options;
    
    const query = orderBy.reduce(
      (q, { field, direction }) => q.orderBy(field, direction),
      this.kysely
        .selectFrom(this.tableName)
        .selectAll()
        .limit(limit)
        .offset(offset)
    );

    return query.execute() as Promise<V[]>;
  }

  async findWithCursor(options: CursorOptions<V>): Promise<PaginationResult<V>> {
    const { cursorField, cursor, limit = 20, direction = 'desc' } = options;
    
    let query = this.kysely
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
    return this.kysely
      .insertInto(this.tableName)
      .values(entity as any)
      .returningAll()
      .executeTakeFirstOrThrow() as Promise<V>;
  }

  async update(id: K, entity: Partial<V>): Promise<V | undefined> {
    const whereCondition = this.schema.buildWhereCondition(id);
    
    const query = this.applyWhereConditions(
      this.kysely
        .updateTable(this.tableName)
        .set(entity as any)
        .returningAll(),
      whereCondition
    );
    
    return query.executeTakeFirst() as Promise<V | undefined>;
  }

  async delete(id: K): Promise<boolean> {
    const whereCondition = this.schema.buildWhereCondition(id);
    
    const query = this.applyWhereConditions(
      this.kysely.deleteFrom(this.tableName),
      whereCondition
    );
    
    const result = await query.executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }
}

