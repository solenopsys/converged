import { SqlMigration, SqlStore, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_invites", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("invites")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("email", "text", (col) => col.notNull())
      .addColumn("name", "text")
      .addColumn("preset", "text", (col) => col.notNull())
      .addColumn("tags", "text", (col) => col.notNull().defaultTo("[]"))
      .addColumn("invitedBy", "text", (col) => col.notNull())
      .addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
      .addColumn("expiresAt", "text", (col) => col.notNull())
      .addColumn("sentAt", "text")
      .addColumn("acceptedAt", "text")
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .addColumn("updatedAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();

    // The sign-in gate asks one question — "is there a live invitation for this
    // address?" — on every magic-link request, before it has decided whether to
    // answer at all. That lookup is the hot path here, not the listing.
    await this.store.db.schema
      .createIndex("invites_email")
      .ifNotExists()
      .on("invites")
      .columns(["email", "status"])
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("invites").ifExists().execute();
  }
}
