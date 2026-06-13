import { SqlMigration, type SqlStore } from "back-core";

export default class AddEventLabel extends SqlMigration {
	constructor(store: SqlStore) {
		super("add_event_label", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.alterTable("events")
			.addColumn("label", "text")
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema
			.alterTable("events")
			.dropColumn("label")
			.execute();
	}
}
