

## 🎯 **Подход "Свой API + реэкспорт":**

```typescript
// @yourcompany/data-core/src/interfaces.ts
export interface Repository<T> {
  findById(id: any): Promise<T | undefined>;
  findAll(options?: FindAllOptions): Promise<T[]>;
  findWithCursor(options: CursorOptions<T>): Promise<PaginationResult<T>>;
  create(data: Partial<T>): Promise<T>;
  update(id: any, data: Partial<T>): Promise<T | undefined>;
  delete(id: any): Promise<boolean>;
  count(): Promise<number>;
}

export interface RepositoryFactory {
  createRepository<T>(config: RepositoryConfig): Repository<T>;
}

// @yourcompany/data-core/src/types.ts  
export interface FindAllOptions {
  limit?: number;
  offset?: number;
  orderBy?: { field: string; direction: 'asc' | 'desc' }[];
}

export interface CursorOptions<T> {
  cursorField: keyof T;
  cursor?: any;
  limit?: number;
  direction?: 'asc' | 'desc';
}

export interface PaginationResult<T> {
  data: T[];
  nextCursor?: any;
  hasMore: boolean;
}

// @yourcompany/data-core/src/index.ts
export * from './interfaces';
export * from './types';

// Реэкспортируем полезные вещи из Kysely
export type { 
  Insertable, 
  Updateable, 
  Selectable 
} from 'kysely';

// Но НЕ экспортируем сам Kysely класс
```

## 🔧 **Implementation под капотом:**

```typescript
// @yourcompany/data-core/src/kysely-implementation.ts
import { Kysely } from 'kysely';
import { Repository, RepositoryFactory, FindAllOptions } from './interfaces';

class KyselyRepository<T> implements Repository<T> {
  constructor(
    private db: Kysely<any>,
    private tableName: string,
    private primaryKey: string | string[],
    private schema: RepositorySchema<T>
  ) {}

  async findById(id: any): Promise<T | undefined> {
    // Ваша логика с Kysely
    if (Array.isArray(this.primaryKey)) {
      let query = this.db.selectFrom(this.tableName).selectAll();
      this.primaryKey.forEach((key, index) => {
        query = query.where(key, '=', id[index]);
      });
      return query.executeTakeFirst() as Promise<T | undefined>;
    } else {
      return this.db
        .selectFrom(this.tableName)
        .selectAll()
        .where(this.primaryKey, '=', id)
        .executeTakeFirst() as Promise<T | undefined>;
    }
  }

  async findAll(options: FindAllOptions = {}): Promise<T[]> {
    const { limit = 100, offset = 0, orderBy = [] } = options;
    
    let query = this.db
      .selectFrom(this.tableName)
      .selectAll()
      .limit(limit)
      .offset(offset);

    // Добавляем сортировку
    orderBy.forEach(({ field, direction }) => {
      query = query.orderBy(field as any, direction);
    });

    return query.execute() as Promise<T[]>;
  }

  async findWithCursor(options: CursorOptions<T>): Promise<PaginationResult<T>> {
    // Ваша курсорная пагинация через Kysely
    const { cursorField, cursor, limit = 20, direction = 'desc' } = options;
    
    let query = this.db.selectFrom(this.tableName).selectAll();
    
    if (cursor !== undefined) {
      const operator = direction === 'desc' ? '<' : '>';
      query = query.where(cursorField as any, operator, cursor);
    }
    
    query = query.orderBy(cursorField as any, direction).limit(limit + 1);
    
    const results = await query.execute() as T[];
    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, -1) : results;
    const nextCursor = hasMore ? data[data.length - 1]?.[cursorField] : undefined;
    
    return { data, nextCursor, hasMore };
  }

  // ... остальные методы
}

export class KyselyRepositoryFactory implements RepositoryFactory {
  constructor(private db: Kysely<any>) {}

  createRepository<T>(config: RepositoryConfig): Repository<T> {
    return new KyselyRepository<T>(
      this.db, 
      config.tableName, 
      config.primaryKey,
      config.schema
    );
  }
}
```

## 🚀 **Публичный API для пользователей:**

```typescript
// @yourcompany/data-core/src/factory.ts
export function createRepositoryFactory(database: any): RepositoryFactory {
  // Автоматически определяем тип базы и создаем нужную фабрику
  if (database.constructor.name === 'Kysely') {
    return new KyselyRepositoryFactory(database);
  }
  
  // В будущем можно добавить поддержку других ORM
  // if (database instanceof PrismaClient) {
  //   return new PrismaRepositoryFactory(database);
  // }
  
  throw new Error('Unsupported database type');
}

// Удобные хелперы
export function createRepository<T>(
  factory: RepositoryFactory,
  tableName: string,
  primaryKey: string | string[]
): Repository<T> {
  return factory.createRepository<T>({
    tableName,
    primaryKey,
    schema: {} // можно расширить в будущем
  });
}
```

## 🎯 **Использование в проектах:**

```typescript
// app/database.ts
import { Kysely, SqliteDialect } from 'kysely';
import { createRepositoryFactory, createRepository } from '@yourcompany/data-core';

const db = new Kysely({
  dialect: new SqliteDialect({...})
});

const factory = createRepositoryFactory(db);

// Создаем репозитории через ваш API
export const runsRepo = createRepository<RunsTable>(factory, 'runs', 'pid');
export const eventsRepo = createRepository<EventsTable>(factory, 'events', 'event_id');
export const nodesRepo = createRepository<NodesTable>(factory, 'nodes', ['pid', 'node_name']);

// app/services/workflow.ts
import { runsRepo, eventsRepo } from '../database';

export class WorkflowService {
  async startWorkflow(workflow: string) {
    // Пользователи используют ваш чистый API
    const run = await runsRepo.create({
      pid: generatePid(),
      workflow,
      started_at: Date.now(),
      status: 'running'
    });

    const { data, nextCursor, hasMore } = await runsRepo.findWithCursor({
      cursorField: 'started_at',
      limit: 20,
      direction: 'desc'
    });

    return { run, recentRuns: data };
  }
}
```

## ✅ **Преимущества такого подхода:**

1. **Ваш API** - полный контроль над интерфейсом
2. **Скрытая сложность** - пользователи не знают про Kysely
3. **Легкая замена** - можете поменять ORM без breaking changes
4. **Реэкспорт типов** - берете лучшее из Kysely (Insertable, Updateable)
5. **Постепенная миграция** - можете добавить поддержку других ORM

## 🔄 **Эволюция библиотеки:**

```typescript
// Версия 1.0 - только Kysely
export function createRepositoryFactory(db: Kysely<any>) { ... }

// Версия 2.0 - добавили Prisma
export function createRepositoryFactory(db: Kysely<any> | PrismaClient) { ... }

// Версия 3.0 - добавили собственный query builder
export function createRepositoryFactory(db: DatabaseConnection) { ... }
```

**Пользователи не заметят изменений** - API останется тем же!

## 💡 **Мой вердикт:**

**Это отличная стратегия!** Вы получаете:
- Контроль над API
- Гибкость implementation
- Возможность эволюции
- Лучшее из двух миров

Начните с Kysely под капотом, реэкспортируйте нужные типы, но создайте свой интерфейс. Это modern best practice для библиотек.
