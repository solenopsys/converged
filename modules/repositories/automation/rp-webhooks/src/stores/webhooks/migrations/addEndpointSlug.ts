import { SqlMigration, type SqlStore, sql } from "back-core";

/**
 * The public half of an endpoint: the path segment a producer posts to, the
 * topic the arrival is published under, and how the delivery is authenticated.
 *
 * Existing rows get their id as the slug. That keeps every already-configured
 * endpoint reachable at a URL that is still unique, and an operator can rename
 * it to something readable afterwards.
 */
export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("add_endpoint_slug", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .alterTable("webhook_endpoints")
      .addColumn("slug", "text")
      .execute();
    await this.store.db.schema
      .alterTable("webhook_endpoints")
      .addColumn("topic", "text")
      .execute();
    await this.store.db.schema
      .alterTable("webhook_endpoints")
      .addColumn("verify", "text")
      .execute();

    await sql`UPDATE webhook_endpoints SET slug = id WHERE slug IS NULL`.execute(
      this.store.db,
    );
    await sql`UPDATE webhook_endpoints SET verify = 'secret' WHERE verify IS NULL`.execute(
      this.store.db,
    );

    // Unique rather than merely indexed: the slug is what the router resolves,
    // and two endpoints answering one URL is not a state worth supporting.
    await this.store.db.schema
      .createIndex("webhook_endpoints_slug")
      .unique()
      .on("webhook_endpoints")
      .column("slug")
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema
      .dropIndex("webhook_endpoints_slug")
      .ifExists()
      .execute();
  }
}
