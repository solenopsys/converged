import { SqlMigration, type SqlStore } from "back-core";

export default class AddEventParentId extends SqlMigration {
	constructor(store: SqlStore) {
		super("add_event_parent_id", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.alterTable("events")
			.addColumn("parentId", "text")
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema
			.alterTable("events")
			.dropColumn("parentId")
			.execute();
	}
}
