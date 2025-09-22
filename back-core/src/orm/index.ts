// orm.ts
import { Database } from "bun:sqlite";

// Типы
type Entity = Record<string, any>;
type QueryParams = Record<string, any>;

// Основная функция создания ORM
export function createOrm(dbPath: string) {
  const db = new Database(dbPath);

  // Функция для выполнения запросов с маппингом
  function query<T extends Entity = any>(sql: string, params: QueryParams = {}): T[] {
    const stmt = db.prepare(sql);
    const rows = stmt.all(params) as T[];
    return rows;
  }

  // Функция для одной записи
  function queryOne<T extends Entity = any>(sql: string, params: QueryParams = {}): T | null {
    const stmt = db.prepare(sql);
    const row = stmt.get(params) as T | undefined;
    return row || null;
  }

  // Функция для изменений (INSERT, UPDATE, DELETE)
  function execute(sql: string, params: QueryParams = {}): { changes: number; lastInsertRowid: number } {
    const stmt = db.prepare(sql);
    const result = stmt.run(params);
    return {
      changes: result.changes,
      lastInsertRowid: Number(result.lastInsertRowid)
    };
  }

  // Простой query builder для частых операций
  function table<T extends Entity = any>(tableName: string) {
    return {
      // SELECT * FROM table
      all(): T[] {
        return query<T>(`SELECT * FROM ${tableName}`);
      },

      // SELECT * FROM table WHERE conditions
      where(conditions: Partial<T>): T[] {
        const keys = Object.keys(conditions);
        const whereClause = keys.map(key => `${key} = $${key}`).join(' AND ');
        return query<T>(`SELECT * FROM ${tableName} WHERE ${whereClause}`, conditions);
      },

      // SELECT * FROM table WHERE id = ?
      findById(id: number | string): T | null {
        return queryOne<T>(`SELECT * FROM ${tableName} WHERE id = $id`, { id });
      },

      // INSERT INTO table
      insert(data: Partial<T>): { id: number; changes: number } {
        const keys = Object.keys(data);
        const values = keys.map(key => `$${key}`).join(', ');
        const columns = keys.join(', ');
        
        const result = execute(
          `INSERT INTO ${tableName} (${columns}) VALUES (${values})`,
          data
        );
        
        return { id: result.lastInsertRowid, changes: result.changes };
      },

      // UPDATE table SET ... WHERE id = ?
      update(id: number | string, data: Partial<T>): number {
        const keys = Object.keys(data);
        const setClause = keys.map(key => `${key} = $${key}`).join(', ');
        
        const result = execute(
          `UPDATE ${tableName} SET ${setClause} WHERE id = $id`,
          { ...data, id }
        );
        
        return result.changes;
      },

      // DELETE FROM table WHERE id = ?
      delete(id: number | string): number {
        const result = execute(`DELETE FROM ${tableName} WHERE id = $id`, { id });
        return result.changes;
      }
    };
  }

  // Закрытие соединения
  function close() {
    db.close();
  }

  return {
    query,
    queryOne, 
    execute,
    table,
    close,
    db // для доступа к нативному API если нужно
  };
}

// Типы для удобства
export type ORM = ReturnType<typeof createOrm>;
export type Table<T> = ReturnType<ORM['table']>;

// Пример использования:

// Определяем интерфейсы
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}

interface Post {
  id: number;
  title: string;
  content: string;
  userId: number;
}

// Создаем ORM
const orm = createOrm('./db.sqlite');

// Создаем таблицы
orm.execute(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    age INTEGER
  )
`);

orm.execute(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT,
    userId INTEGER,
    FOREIGN KEY (userId) REFERENCES users (id)
  )
`);

// Работаем с таблицами
const users = orm.table<User>('users');
const posts = orm.table<Post>('posts');

// Примеры использования:

// Добавляем пользователей
const userId = users.insert({ 
  name: 'John Doe', 
  email: 'john@example.com', 
  age: 30 
}).id;

users.insert({ 
  name: 'Jane Smith', 
  email: 'jane@example.com', 
  age: 25 
});

// Добавляем посты
posts.insert({
  title: 'My first post',
  content: 'Hello world!',
  userId: userId
});

// Читаем данные
console.log('All users:', users.all());
console.log('User by ID:', users.findById(1));
console.log('Users over 25:', users.where({ age: 30 }));

// Обновляем
users.update(1, { age: 31 });

// Сложные запросы через query()
const usersWithPosts = orm.query<User & { postsCount: number }>(`
  SELECT u.*, COUNT(p.id) as postsCount 
  FROM users u 
  LEFT JOIN posts p ON u.id = p.userId 
  GROUP BY u.id
`);

console.log('Users with post counts:', usersWithPosts);

// Raw запросы с параметрами
const youngUsers = orm.query<User>(
  'SELECT * FROM users WHERE age < $maxAge ORDER BY age DESC',
  { maxAge: 30 }
);

console.log('Young users:', youngUsers);

// Закрываем соединение
// orm.close();