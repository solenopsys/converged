import { SqlStore, SqlMigration } from "back-core";

/**
 * The link between a solution and the functions whose calls mean it was used,
 * plus the indexes every aggregate here reads through.
 *
 * The indexes arrive with this migration rather than with `create_usage`
 * because that one has already run everywhere: an existing deployment gets them
 * by migrating forward, and a fresh one ends up with the same schema either
 * way.
 */
export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_usage_solutions", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("usage_solutions")
      .ifNotExists()
      .addColumn("solution", "text", (col) => col.notNull())
      .addColumn("func", "text", (col) => col.notNull())
      .addPrimaryKeyConstraint("usage_solutions_pk", ["solution", "func"])
      .execute();

    // Joining events to solutions starts from the function name, so the pair
    // index the primary key gives is the wrong way round for that direction.
    await this.store.db.schema
      .createIndex("usage_solutions_func_idx")
      .ifNotExists()
      .on("usage_solutions")
      .column("func")
      .execute();

    // Every read is a range on `date` narrowed by `func` or `user`; without
    // these the daily chart is a full scan of the event log.
    await this.store.db.schema
      .createIndex("usage_events_date_idx")
      .ifNotExists()
      .on("usage_events")
      .column("date")
      .execute();

    await this.store.db.schema
      .createIndex("usage_events_func_date_idx")
      .ifNotExists()
      .on("usage_events")
      .columns(["func", "date"])
      .execute();

    await this.store.db.schema
      .createIndex("usage_events_user_date_idx")
      .ifNotExists()
      .on("usage_events")
      .columns(["user", "date"])
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropIndex("usage_events_user_date_idx").ifExists().execute();
    await this.store.db.schema.dropIndex("usage_events_func_date_idx").ifExists().execute();
    await this.store.db.schema.dropIndex("usage_events_date_idx").ifExists().execute();
    await this.store.db.schema.dropIndex("usage_solutions_func_idx").ifExists().execute();
    await this.store.db.schema.dropTable("usage_solutions").ifExists().execute();
  }
}
