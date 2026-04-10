import { SqlMigration, SqlStore } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("add_user_preset", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .alterTable("users")
      .addColumn("preset", "text", (col) => col.notNull().defaultTo("user"))
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema
      .alterTable("users")
      .dropColumn("preset")
      .execute();
  }
}

