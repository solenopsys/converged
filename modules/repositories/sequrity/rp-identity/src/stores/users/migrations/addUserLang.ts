import { SqlMigration, type SqlStore } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("add_user_lang", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.alterTable("users")
			.addColumn("lang", "text")
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema.alterTable("users").dropColumn("lang").execute();
	}
}
