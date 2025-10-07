
import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('file_metadata')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('hash', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('fileSize', 'integer', (col) => col.notNull())
    .addColumn('fileType', 'text', (col) => col.notNull())
    .addColumn('compression', 'text', (col) => col.notNull())
    .addColumn('owner', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'text', (col) => col.notNull())
    .addColumn('chunksCount', 'integer', (col) => col.notNull())
    .execute();

  await db.schema
    .createTable('file_chunks')
    .addColumn('fileId', 'text', (col) => col.notNull())
    .addColumn('hash', 'text', (col) => col.notNull())
    .addColumn('chunkNumber', 'integer', (col) => col.notNull())
    .addColumn('chunkSize', 'integer', (col) => col.notNull())
    .addColumn('createdAt', 'text', (col) => col.notNull())
    .addPrimaryKeyConstraint('file_chunks_pk', ['fileId', 'chunkNumber'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('file_chunks').execute();
  await db.schema.dropTable('file_metadata').execute();
}
