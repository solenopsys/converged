import { SqlMigration, type SqlStore, sql } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("create_lead_tags", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable("lead_tags")
			.ifNotExists()
			.addColumn("leadId", "text", (col) => col.notNull())
			.addColumn("tagName", "text", (col) => col.notNull())
			.addColumn("createdAt", "integer", (col) =>
				col.notNull().defaultTo(sql`(strftime('%s', 'now'))`),
			)
			.addPrimaryKeyConstraint("pk_lead_tags", ["leadId", "tagName"])
			.execute();

		await this.store.db.schema
			.createIndex("idx_lead_tags_tag_name")
			.ifNotExists()
			.on("lead_tags")
			.column("tagName")
			.execute();

		await this.store.db.schema
			.createIndex("idx_lead_tags_lead_id")
			.ifNotExists()
			.on("lead_tags")
			.column("leadId")
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema.dropTable("lead_tags").ifExists().execute();
	}
}
