import { SqlMigration, SqlStore } from "back-core";

/**
 * Row-level visibility for sections and topics.
 *
 * One column and nothing else: the tags themselves belong in the shared
 * `access_tags` relation described in `access-control.md`, and an owner is the
 * tag `u<userId>` rather than a column here. Existing rows become
 * `authenticated` — what they effectively already were, since any logged-in
 * caller could read them — and not `public`, which would hand the forum to
 * anonymous visitors as a side effect of a migration.
 */
export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("add_community_visibility", store);
  }

  async up(): Promise<void> {
    for (const table of ["community_sections", "community_topics"]) {
      try {
        await this.store.db.schema
          .alterTable(table)
          .addColumn("visibility", "text", (col) =>
            col.defaultTo("authenticated").notNull(),
          )
          .execute();
      } catch {
        // Column may already exist.
      }
    }

    try {
      await this.store.db.schema
        .alterTable("community_sections")
        .addColumn("createdBy", "text")
        .execute();
    } catch {
      // Column may already exist.
    }
  }

  async down(): Promise<void> {
    for (const table of ["community_sections", "community_topics"]) {
      await this.store.db.schema.alterTable(table).dropColumn("visibility").execute();
    }
    await this.store.db.schema
      .alterTable("community_sections")
      .dropColumn("createdBy")
      .execute();
  }
}
