import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_community_topics", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("community_topics")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("sectionId", "text", (col) => col.notNull())
      .addColumn("threadId", "text", (col) => col.notNull())
      .addColumn("title", "text", (col) => col.notNull())
      .addColumn("createdBy", "text", (col) => col.notNull())
      .addColumn("isPinned", "integer", (col) => col.defaultTo(0).notNull())
      .addColumn("isLocked", "integer", (col) => col.defaultTo(0).notNull())
      .addColumn("isArchived", "integer", (col) => col.defaultTo(0).notNull())
      .addColumn("lastActivityAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .addColumn("updatedAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();

    await this.store.db.schema
      .createIndex("idx_community_topics_section")
      .ifNotExists()
      .on("community_topics")
      .column("sectionId")
      .execute();

    await this.store.db.schema
      .createIndex("idx_community_topics_order")
      .ifNotExists()
      .on("community_topics")
      .columns(["sectionId", "isPinned", "lastActivityAt"])
      .execute();

    await this.store.db.schema
      .createIndex("idx_community_topics_thread")
      .ifNotExists()
      .on("community_topics")
      .column("threadId")
      .unique()
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("community_topics").ifExists().execute();
  }
}
