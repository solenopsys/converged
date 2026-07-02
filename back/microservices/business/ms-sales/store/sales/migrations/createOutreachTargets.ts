import { SqlMigration, type SqlStore, sql } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("create_outreach_targets", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable("outreach_targets")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("outreachId", "text", (col) => col.notNull())
			.addColumn("status", "text", (col) => col.notNull().defaultTo("planned"))
			.addColumn("position", "integer", (col) => col.notNull().defaultTo(0))
			.addColumn("payload", "text", (col) => col.notNull())
			.addColumn("createdAt", "integer", (col) =>
				col.notNull().defaultTo(sql`(strftime('%s', 'now'))`),
			)
			.addColumn("updatedAt", "integer", (col) =>
				col.notNull().defaultTo(sql`(strftime('%s', 'now'))`),
			)
			.execute();

		await this.store.db.schema
			.createIndex("idx_outreach_targets_status_position")
			.ifNotExists()
			.on("outreach_targets")
			.columns(["outreachId", "status", "position"])
			.execute();

		await sql`drop index if exists uq_outreach_targets_lead`.execute(this.store.db);

		await sql`
			create unique index if not exists uq_outreach_targets_company_lead
			on outreach_targets(
				json_extract(payload, '$.outreach.companyName'),
				json_extract(payload, '$.lead.id')
			)
		`.execute(this.store.db);
	}

	async down(): Promise<void> {
		await this.store.db.schema
			.dropTable("outreach_targets")
			.ifExists()
			.execute();
	}
}
