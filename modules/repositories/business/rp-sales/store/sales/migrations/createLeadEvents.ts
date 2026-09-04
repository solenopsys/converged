import { SqlMigration, type SqlStore, sql } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("create_lead_events", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable("lead_events")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("code", "text", (col) => col.notNull())
			.addColumn("type", "text", (col) => col.notNull())
			.addColumn("contactId", "text")
			.addColumn("leadId", "text")
			.addColumn("url", "text")
			.addColumn("referrer", "text")
			.addColumn("userAgent", "text")
			.addColumn("createdAt", "integer", (col) =>
				col.notNull().defaultTo(sql`(strftime('%s', 'now'))`),
			)
			.execute();

		await this.store.db.schema
			.createIndex("idx_lead_events_code")
			.ifNotExists()
			.on("lead_events")
			.column("code")
			.execute();

		await this.store.db.schema
			.createIndex("idx_lead_events_lead_id")
			.ifNotExists()
			.on("lead_events")
			.column("leadId")
			.execute();

		await this.store.db.schema
			.createIndex("idx_lead_events_type")
			.ifNotExists()
			.on("lead_events")
			.column("type")
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema.dropTable("lead_events").ifExists().execute();
	}
}
