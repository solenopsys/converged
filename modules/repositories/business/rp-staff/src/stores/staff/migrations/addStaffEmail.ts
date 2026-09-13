import { SqlMigration, type SqlStore } from "back-core";

/**
 * The address a card is joined to an identity by, and the language its letters
 * are written in. Both nullable: cards filed before the import exist and are
 * valid, they simply have nobody to match yet.
 */
export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("add_staff_email", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.alterTable("staff_members")
			.addColumn("email", "text")
			.execute();
		await this.store.db.schema
			.alterTable("staff_members")
			.addColumn("lang", "text")
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema
			.alterTable("staff_members")
			.dropColumn("email")
			.execute();
		await this.store.db.schema
			.alterTable("staff_members")
			.dropColumn("lang")
			.execute();
	}
}
