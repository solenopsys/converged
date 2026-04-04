import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_community_sections", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("community_sections")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("parentId", "text")
      .addColumn("slug", "text", (col) => col.notNull())
      .addColumn("title", "text", (col) => col.notNull())
      .addColumn("description", "text")
      .addColumn("sortOrder", "integer", (col) => col.defaultTo(0).notNull())
      .addColumn("isHidden", "integer", (col) => col.defaultTo(0).notNull())
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .addColumn("updatedAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();

    await this.store.db.schema
      .createIndex("idx_community_sections_parent_sort")
      .ifNotExists()
      .on("community_sections")
      .columns(["parentId", "sortOrder"])
      .execute();

    await this.store.db.schema
      .createIndex("idx_community_sections_parent_slug")
      .ifNotExists()
      .on("community_sections")
      .columns(["parentId", "slug"])
      .unique()
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("community_sections").ifExists().execute();
  }
}
