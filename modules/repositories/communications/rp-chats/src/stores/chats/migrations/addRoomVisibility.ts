import { SqlMigration, SqlStore } from "back-core";

/**
 * Row-level visibility for rooms.
 *
 * `tagged` for existing rows, because that is what a room already was in
 * practice: you see it if you are in it. The membership itself stays in
 * `chart_room_users`, which also carries the role — a tag cannot express
 * `owner` versus `member`, so the table does not go away when `access_tags`
 * arrives.
 */
export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("add_chart_rooms_visibility", store);
  }

  async up(): Promise<void> {
    try {
      await this.store.db.schema
        .alterTable("chart_rooms")
        .addColumn("visibility", "text", (col) => col.defaultTo("tagged").notNull())
        .execute();
    } catch {
      // Column may already exist.
    }
  }

  async down(): Promise<void> {
    await this.store.db.schema
      .alterTable("chart_rooms")
      .dropColumn("visibility")
      .execute();
  }
}
