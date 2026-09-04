import { SqlMigration, type SqlStore, sql } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("create_lead_audiences", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable("lead_audiences")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("name", "text", (col) => col.notNull())
			.addColumn("description", "text", (col) => col.notNull().defaultTo(""))
			.addColumn("createdAt", "integer", (col) =>
				col.notNull().defaultTo(sql`(strftime('%s', 'now'))`),
			)
			.addColumn("updatedAt", "integer", (col) =>
				col.notNull().defaultTo(sql`(strftime('%s', 'now'))`),
			)
			.execute();

		await this.store.db.schema
			.createTable("lead_audience_members")
			.ifNotExists()
			.addColumn("audienceId", "text", (col) => col.notNull())
			.addColumn("leadId", "text", (col) => col.notNull())
			.addColumn("createdAt", "integer", (col) =>
				col.notNull().defaultTo(sql`(strftime('%s', 'now'))`),
			)
			.addPrimaryKeyConstraint("pk_lead_audience_members", [
				"audienceId",
				"leadId",
			])
			.execute();

		await this.store.db.schema
			.createIndex("idx_lead_audience_members_lead")
			.ifNotExists()
			.on("lead_audience_members")
			.column("leadId")
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema
			.dropTable("lead_audience_members")
			.ifExists()
			.execute();
		await this.store.db.schema.dropTable("lead_audiences").ifExists().execute();
	}
}
