// database.ts
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'bun:sqlite';

export interface Workflow {
  id: number;
  name: string;
  config: string;
  created_at: string;
}

export interface Webhook {
  id: number;
  workflow_id: number;
  url: string;
  secret: string | null;
  created_at: string;
  is_active: boolean;
}

export interface DB {
  workflows: Workflow;
  webhooks: Webhook;
}

export const createDB = () => {
  const sqlite = new Database(process.env.SQLITE_PATH);
  
  const db = new Kysely<DB>({
    dialect: new SqliteDialect({ database: sqlite }),
  });

  return { db, sqlite };
};

export const migrate = async (db: Kysely<DB>) => {
  await db.schema
    .createTable('workflows')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('name', 'text', (col) => col.notNull().unique())
    .addColumn('config', 'text', (col) => col.notNull())
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo('CURRENT_TIMESTAMP'))
    .execute();

  await db.schema
    .createTable('webhooks')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('workflow_id', 'integer', (col) => col.notNull().references('workflows.id').onDelete('cascade'))
    .addColumn('url', 'text', (col) => col.notNull())
    .addColumn('secret', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo('CURRENT_TIMESTAMP'))
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .execute();
};