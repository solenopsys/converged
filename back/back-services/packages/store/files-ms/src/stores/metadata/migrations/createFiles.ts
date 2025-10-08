import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
    constructor(store: SqlStore) {
        super('create_files', store);
    }

    async up(): Promise<void> {
        await this.store.db.schema
            .createTable('file_metadata')
            .ifNotExists()
            .addColumn('id', 'text', (col) => col.primaryKey())
            .addColumn('hash', 'text', (col) => col.notNull())
            .addColumn('status', 'text', (col) => col.notNull())
            .addColumn('name', 'text', (col) => col.notNull())
            .addColumn('fileSize', 'integer', (col) => col.notNull())
            .addColumn('fileType', 'text', (col) => col.notNull())
            .addColumn('compression', 'text', (col) => col.notNull())
            .addColumn('owner', 'text', (col) => col.notNull())
            .addColumn('createdAt', 'text', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
            .addColumn('chunksCount', 'integer', (col) => col.notNull())
            .execute();

        await this.store.db.schema
            .createTable('file_chunks')
            .ifNotExists()
            .addColumn('fileId', 'text', (col) => col.notNull())
            .addColumn('hash', 'text', (col) => col.notNull())
            .addColumn('chunkNumber', 'integer', (col) => col.notNull())
            .addColumn('chunkSize', 'integer', (col) => col.notNull())
            .addColumn('createdAt', 'text', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
            .addPrimaryKeyConstraint('file_chunks_pk', ['fileId', 'chunkNumber'])
            .execute();
    }

    async down(): Promise<void> {
        await this.store.db.schema.dropTable('file_chunks').ifExists().execute();
        await this.store.db.schema.dropTable('file_metadata').ifExists().execute();
    }
}