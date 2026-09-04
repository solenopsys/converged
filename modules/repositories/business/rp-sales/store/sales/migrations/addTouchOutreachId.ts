import { SqlMigration, type SqlStore } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("add_touch_outreach_id", store);
	}

	async up(): Promise<void> {
		try {
			await this.store.db.schema
				.alterTable("touches")
				.addColumn("outreachId", "text")
				.execute();
		} catch {
			// column already exists
		}

		await this.store.db.schema
			.createIndex("idx_touches_outreach_contact")
			.ifNotExists()
			.on("touches")
			.columns(["outreachId", "contactId"])
			.execute();
	}

	async down(): Promise<void> {}
}
