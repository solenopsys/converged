export { sql } from "kysely";

export interface KeyColumn {
  [key: string]: any;
}

export interface FindAllOptions {
  limit?: number;
  offset?: number;
  orderBy?: Array<{ field: string; direction: "asc" | "desc" }>;
}

export interface CursorOptions<V> {
  cursorField: keyof V;
  cursor?: any;
  limit?: number;
  direction?: "asc" | "desc";
}

export interface PaginationResult<V> {
  data: V[];
  nextCursor?: any;
  hasMore: boolean;
}

export interface RepositorySchema<K extends KeyColumn, V> {
  primaryKey: keyof V | Array<keyof V>;
  extractKey: (entity: V) => K;
  buildWhereCondition: (key: K) => Record<string, any>;
}

export interface RepositoryColumn<K extends KeyColumn, V> {
  findById(id: K): Promise<V | undefined>;
  findAll(options?: FindAllOptions): Promise<V[]>;
  findWithCursor(options: CursorOptions<V>): Promise<PaginationResult<V>>;
  count(): Promise<number>;
  create(entity: Omit<V, keyof K>): Promise<V>;
  update(id: K, entity: Partial<V>): Promise<V | undefined>;
  delete(id: K): Promise<boolean>;
}
