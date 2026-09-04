import { SqlStore, SqlMigration } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("create_mappings", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable("mappings")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey().notNull())
			.addColumn("groupId", "text", (col) => col.notNull())
			.addColumn("key", "text", (col) => col.notNull())
			.addColumn("value", "text", (col) => col.notNull())
			.addColumn("createdAt", "integer", (col) => col.notNull())
			.addColumn("updatedAt", "integer", (col) => col.notNull())
			.execute();

		await this.store.db.schema
			.createIndex("idx_classifier_mappings_group_key")
			.ifNotExists()
			.on("mappings")
			.columns(["groupId", "key"])
			.unique()
			.execute();

		await this.store.db.schema
			.createIndex("idx_classifier_mappings_group_value")
			.ifNotExists()
			.on("mappings")
			.columns(["groupId", "value"])
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema
			.dropIndex("idx_classifier_mappings_group_value")
			.ifExists()
			.execute();
		await this.store.db.schema
			.dropIndex("idx_classifier_mappings_group_key")
			.ifExists()
			.execute();
		await this.store.db.schema.dropTable("mappings").ifExists().execute();
	}
}
