import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_chart_room_users", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("chart_room_users")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("roomId", "text", (col) => col.notNull())
      .addColumn("userId", "text", (col) => col.notNull())
      .addColumn("role", "text", (col) => col.defaultTo("member").notNull())
      .addColumn("joinedAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .addColumn("updatedAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();

    await this.store.db.schema
      .createIndex("idx_chart_room_users_room")
      .ifNotExists()
      .on("chart_room_users")
      .column("roomId")
      .execute();

    await this.store.db.schema
      .createIndex("idx_chart_room_users_user")
      .ifNotExists()
      .on("chart_room_users")
      .column("userId")
      .execute();

    await this.store.db.schema
      .createIndex("idx_chart_room_users_room_user")
      .ifNotExists()
      .on("chart_room_users")
      .columns(["roomId", "userId"])
      .unique()
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("chart_room_users").ifExists().execute();
  }
}
