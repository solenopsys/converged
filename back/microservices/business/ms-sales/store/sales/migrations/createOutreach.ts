import { SqlMigration, type SqlStore, sql } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("create_outreach", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable("outreaches")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("name", "text", (col) => col.notNull())
			.addColumn("status", "text", (col) => col.notNull().defaultTo("draft"))
			.addColumn("lang", "text", (col) => col.notNull().defaultTo(""))
			.addColumn("description", "text", (col) => col.notNull().defaultTo(""))
			.addColumn("createdAt", "integer", (col) =>
				col.notNull().defaultTo(sql`(strftime('%s', 'now'))`),
			)
			.addColumn("updatedAt", "integer", (col) =>
				col.notNull().defaultTo(sql`(strftime('%s', 'now'))`),
			)
			.execute();

		await this.store.db.schema
			.createIndex("idx_outreaches_status")
			.ifNotExists()
			.on("outreaches")
			.column("status")
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema.dropTable("outreaches").ifExists().execute();
	}
}
