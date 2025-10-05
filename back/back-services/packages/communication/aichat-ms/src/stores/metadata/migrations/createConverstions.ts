import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {

    constructor(store: SqlStore) {
        super('create_conversations', store);
    }

    async up(): Promise<void> {
        this.store.db.schema.createTable('conversations').ifNotExists()
            .addColumn('id', 'text', (col) => col.primaryKey())
            .addColumn('created_at', 'text', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .addColumn('updated_at', 'text', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .addColumn('title', 'text')
            .addColumn('messages_count', 'integer', (col) => col.defaultTo(0))
            .execute();
    }

    async down(): Promise<void> {
        this.store.db.schema.dropTable('conversations').ifExists().execute();
    }
}

