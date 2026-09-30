import { SqlMigration, type SqlStore, type Store } from "back-core";

export default class extends SqlMigration {
	constructor(store: Store) {
		super("create_geolite_city_data", store as SqlStore);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable("geolite_city_networks")
			.ifNotExists()
			.addColumn("network", "text", (column) => column.notNull().primaryKey())
			.addColumn("address_family", "integer", (column) => column.notNull())
			.addColumn("network_start", "text", (column) => column.notNull())
			.addColumn("network_end", "text", (column) => column.notNull())
			.addColumn("prefix_length", "integer", (column) => column.notNull())
			.addColumn("geoname_id", "integer")
			.addColumn("registered_country_geoname_id", "integer")
			.addColumn("import_id", "text", (column) =>
				column.notNull().defaultTo(""),
			)
			.addColumn("updated_at", "integer", (column) =>
				column.notNull().defaultTo(0),
			)
			.execute();
		await this.store.db.schema
			.createIndex("geolite_city_range_idx")
			.ifNotExists()
			.on("geolite_city_networks")
			.columns(["address_family", "network_start"])
			.execute();
		await this.store.db.schema
			.createTable("geolite_locations")
			.ifNotExists()
			.addColumn("id", "integer", (column) =>
				column.primaryKey().autoIncrement(),
			)
			.addColumn("dataset", "text", (column) => column.notNull())
			.addColumn("geoname_id", "integer", (column) => column.notNull())
			.addColumn("continent_code", "text", (column) =>
				column.notNull().defaultTo(""),
			)
			.addColumn("continent_name", "text", (column) =>
				column.notNull().defaultTo(""),
			)
			.addColumn("country_code", "text", (column) =>
				column.notNull().defaultTo(""),
			)
			.addColumn("country_name", "text", (column) =>
				column.notNull().defaultTo(""),
			)
			.addColumn("region_code", "text", (column) =>
				column.notNull().defaultTo(""),
			)
			.addColumn("region_name", "text", (column) =>
				column.notNull().defaultTo(""),
			)
			.addColumn("city_name", "text", (column) =>
				column.notNull().defaultTo(""),
			)
			.addColumn("time_zone", "text", (column) =>
				column.notNull().defaultTo(""),
			)
			.addColumn("import_id", "text", (column) =>
				column.notNull().defaultTo(""),
			)
			.addColumn("updated_at", "integer", (column) =>
				column.notNull().defaultTo(0),
			)
			.addUniqueConstraint("geolite_location_key", ["dataset", "geoname_id"])
			.execute();
		await this.store.db.schema
			.createIndex("geolite_location_lookup_idx")
			.ifNotExists()
			.on("geolite_locations")
			.columns(["dataset", "geoname_id"])
			.execute();
		await this.store.db.schema
			.createTable("geolite_import_status")
			.ifNotExists()
			.addColumn("dataset", "text", (column) => column.notNull().primaryKey())
			.addColumn("records", "integer", (column) =>
				column.notNull().defaultTo(0),
			)
			.addColumn("updated_at", "integer", (column) =>
				column.notNull().defaultTo(0),
			)
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema
			.dropTable("geolite_import_status")
			.ifExists()
			.execute();
		await this.store.db.schema
			.dropTable("geolite_locations")
			.ifExists()
			.execute();
		await this.store.db.schema
			.dropTable("geolite_city_networks")
			.ifExists()
			.execute();
	}
}
