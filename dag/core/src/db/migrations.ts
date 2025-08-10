// migrations.ts
import { Kysely } from 'kysely';
import { DB } from './types';

export const migrate = async (db: Kysely<DB>) => {
  await db.schema
    .createTable('nodes')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('name', 'text', (col) => col.notNull()) 
    .addColumn('current_version', 'blob', (col) => col.notNull())
    .addColumn('updated_at', 'integer', (col) => col.notNull().defaultTo('CURRENT_TIMESTAMP'))
    .execute();

  await db.schema
    .createTable('node_versions')
    .ifNotExists()
    .addColumn('hash', 'blob', (col) => col.primaryKey())
    .addColumn('node_id', 'integer', (col) => col.notNull().references('nodes.id').onDelete('cascade'))
    .addColumn('body', 'blob', (col) => col.notNull())
    .addColumn('created_at', 'integer', (col) => col.notNull().defaultTo('CURRENT_TIMESTAMP'))
    .execute();
};