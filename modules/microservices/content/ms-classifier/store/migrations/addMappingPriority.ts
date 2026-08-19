import { SqlStore, SqlMigration } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("add_mapping_priority", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.alterTable("mappings")
			.addColumn("priority", "integer", (col) => col.notNull().defaultTo(0))
			.execute();

		await this.store.db.schema
			.createIndex("idx_classifier_mappings_group_priority")
			.ifNotExists()
			.on("mappings")
			.columns(["groupId", "priority"])
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema
			.dropIndex("idx_classifier_mappings_group_priority")
			.ifExists()
			.execute();
	}
}
