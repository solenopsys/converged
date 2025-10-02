import { Kysely } from 'kysely';

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

// Основной интерфейс репозитория с generic ключом
interface Repository<K, V> {
  findById(id: K): Promise<V | undefined>;
  findAll(options?: FindAllOptions): Promise<V[]>;
  findWithCursor(options: CursorOptions<V>): Promise<PaginationResult<V>>;
  create(entity: Omit<V, keyof K>): Promise<V>;
  update(id: K, entity: Partial<V>): Promise<V | undefined>;
  delete(id: K): Promise<boolean>;
}

// Конфигурация схемы
interface RepositorySchema<K, V> {
  primaryKey: keyof V | Array<keyof V>;
  // Функция для извлечения значения ключа из entity
  extractKey: (entity: V) => K;
  // Функция для создания WHERE условия из ключа
  buildWhereCondition: (key: K) => Record<string, any>;
}

// Реализация репозитория для Kysely
class KyselyRepository<K, V> implements Repository<K, V> {
  constructor(
    private db: Kysely<any>,
    private tableName: string,
    private schema: RepositorySchema<K, V>
  ) {}

  async findById(id: K): Promise<V | undefined> {
    const whereCondition = this.schema.buildWhereCondition(id);
    
    let query = this.db.selectFrom(this.tableName).selectAll();
    
    // Применяем все условия из whereCondition
    Object.entries(whereCondition).forEach(([key, value]) => {
      query = query.where(key, '=', value);
    });
    
    return query.executeTakeFirst() as Promise<V | undefined>;
  }

  async findAll(options: FindAllOptions = {}): Promise<V[]> {
    const { limit = 100, offset = 0, orderBy = [] } = options;
    
    let query = this.db
      .selectFrom(this.tableName)
      .selectAll()
      .limit(limit)
      .offset(offset);

    orderBy.forEach(({ field, direction }) => {
      query = query.orderBy(field, direction);
    });

    return query.execute() as Promise<V[]>;
  }

  async findWithCursor(options: CursorOptions<V>): Promise<PaginationResult<V>> {
    const { cursorField, cursor, limit = 20, direction = 'desc' } = options;
    
    let query = this.db.selectFrom(this.tableName).selectAll();
    
    if (cursor !== undefined) {
      const operator = direction === 'desc' ? '<' : '>';
      query = query.where(cursorField as string, operator, cursor);
    }
    
    query = query.orderBy(cursorField as string, direction).limit(limit + 1);
    
    const results = await query.execute() as V[];
    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, -1) : results;
    const nextCursor = hasMore ? data[data.length - 1]?.[cursorField] : undefined;
    
    return { data, nextCursor, hasMore };
  }

  async create(entity: Omit<V, keyof K>): Promise<V> {
    const result = await this.db
      .insertInto(this.tableName)
      .values(entity as any)
      .returningAll()
      .executeTakeFirstOrThrow();
    
    return result as V;
  }

  async update(id: K, entity: Partial<V>): Promise<V | undefined> {
    const whereCondition = this.schema.buildWhereCondition(id);
    
    let query = this.db
      .updateTable(this.tableName)
      .set(entity as any)
      .returningAll();
    
    Object.entries(whereCondition).forEach(([key, value]) => {
      query = query.where(key, '=', value);
    });
    
    return query.executeTakeFirst() as Promise<V | undefined>;
  }

  async delete(id: K): Promise<boolean> {
    const whereCondition = this.schema.buildWhereCondition(id);
    
    let query = this.db.deleteFrom(this.tableName);
    
    Object.entries(whereCondition).forEach(([key, value]) => {
      query = query.where(key, '=', value);
    });
    
    const result = await query.executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }
}

// Примеры использования:

// 1. Простой ключ (number)
interface User {
  id: number;
  name: string;
  email: string;
}

const userRepository = new KyselyRepository<number, User>(
  db,
  'users',
  {
    primaryKey: 'id',
    extractKey: (user) => user.id,
    buildWhereCondition: (id) => ({ id })
  }
);

// 2. Составной ключ (объект)
interface CompositeKey {
  userId: number;
  projectId: number;
}

interface UserProject {
  userId: number;
  projectId: number;
  role: string;
  joinedAt: Date;
}

const userProjectRepository = new KyselyRepository<CompositeKey, UserProject>(
  db,
  'user_projects',
  {
    primaryKey: ['userId', 'projectId'],
    extractKey: (entity) => ({ 
      userId: entity.userId, 
      projectId: entity.projectId 
    }),
    buildWhereCondition: (key) => ({
      userId: key.userId,
      projectId: key.projectId
    })
  }
);

// 3. Строковый ключ
interface Article {
  slug: string;
  title: string;
  content: string;
}

const articleRepository = new KyselyRepository<string, Article>(
  db,
  'articles',
  {
    primaryKey: 'slug',
    extractKey: (article) => article.slug,
    buildWhereCondition: (slug) => ({ slug })
  }
);

// Использование:
// await userRepository.findById(42);
// await userProjectRepository.findById({ userId: 1, projectId: 5 });
// await articleRepository.findById('my-article-slug');