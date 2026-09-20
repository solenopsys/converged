import { SqlMigration, type SqlStore } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("drop_offer_template_path", store);
	}

	async up(): Promise<void> {
		try {
			await this.store.db.schema
				.alterTable("offers")
				.dropColumn("template_path")
				.execute();
		} catch {
			// Fresh databases no longer create this legacy column.
		}
	}

	async down(): Promise<void> {}
}
