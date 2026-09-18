import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("create_meter", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable("meter_samples")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("owner", "text", (col) => col.notNull())
			.addColumn("resource", "text", (col) => col.notNull())
			.addColumn("amount", "real", (col) => col.notNull())
			.addColumn("at", "text", (col) => col.notNull())
			.execute();

		// Every read is "this owner, this stretch of days", so the owner leads.
		await this.store.db.schema
			.createIndex("meter_samples_owner_at_idx")
			.ifNotExists()
			.on("meter_samples")
			.columns(["owner", "at"])
			.execute();

		// One row per day already charged for. The primary key is the whole
		// mechanism: claiming a day twice is a key collision, so two runs of the
		// charge job cannot both win, whatever order they arrive in.
		await this.store.db.schema
			.createTable("meter_billed")
			.ifNotExists()
			.addColumn("date", "text", (col) => col.notNull())
			.addColumn("owner", "text", (col) => col.notNull())
			.addColumn("resource", "text", (col) => col.notNull())
			.addColumn("claimedAt", "text", (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
			)
			.addPrimaryKeyConstraint("meter_billed_pk", ["date", "owner", "resource"])
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema.dropTable("meter_billed").ifExists().execute();
		await this.store.db.schema.dropIndex("meter_samples_owner_at_idx").ifExists().execute();
		await this.store.db.schema.dropTable("meter_samples").ifExists().execute();
	}
}
