import { SqlMigration, type SqlStore } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("create_contacts", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable("contacts")
			.ifNotExists()
			.addColumn("id", "text", (column) => column.primaryKey())
			.addColumn("clientId", "text", (column) => column.notNull())
			.addColumn("type", "text", (column) => column.notNull())
			.addColumn("value", "text", (column) => column.notNull())
			.addForeignKeyConstraint(
				"contacts_client_id_fk",
				["clientId"],
				"clients",
				["id"],
				(constraint) => constraint.onDelete("cascade"),
			)
			.execute();
		await this.store.db.schema
			.createIndex("contacts_client_id_idx")
			.ifNotExists()
			.on("contacts")
			.column("clientId")
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema.dropTable("contacts").ifExists().execute();
	}
}
