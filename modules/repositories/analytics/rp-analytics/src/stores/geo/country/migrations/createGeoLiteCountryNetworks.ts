import { SqlMigration, SqlStore, type Store } from "back-core";

export default class extends SqlMigration {
	constructor(store: Store) {
		super("create_geolite_country_networks", store as SqlStore);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable("geolite_country_networks")
			.ifNotExists()
			.addColumn("network", "text", (column) => column.notNull().primaryKey())
			.addColumn("address_family", "integer", (column) => column.notNull())
			.addColumn("network_start", "text", (column) => column.notNull())
			.addColumn("network_end", "text", (column) => column.notNull())
			.addColumn("prefix_length", "integer", (column) => column.notNull())
			.addColumn("country_code", "text", (column) => column.notNull())
			.addColumn("country_name", "text", (column) => column.notNull())
			.execute();
		await this.store.db.schema
			.createIndex("geolite_country_range_idx")
			.ifNotExists()
			.on("geolite_country_networks")
			.columns(["address_family", "network_start"])
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema
			.dropIndex("geolite_country_range_idx")
			.ifExists()
			.execute();
		await this.store.db.schema
			.dropTable("geolite_country_networks")
			.ifExists()
			.execute();
	}
}
