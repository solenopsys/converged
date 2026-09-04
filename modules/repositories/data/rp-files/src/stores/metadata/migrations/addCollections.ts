import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("add_file_collections", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("file_collections")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("description", "text")
      .addColumn("owner", "text", (col) => col.notNull())
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();

    const info = await sql<{ name: string }>`PRAGMA table_info(file_metadata)`.execute(
      this.store.db,
    );
    const columns = new Set(info.rows.map((row) => row.name));
    if (!columns.has("collectionId")) {
      await sql`ALTER TABLE file_metadata ADD COLUMN collectionId text REFERENCES file_collections(id)`.execute(
        this.store.db,
      );
    }
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("file_collections").ifExists().execute();
  }
}
