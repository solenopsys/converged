import { SqlMigration, type SqlStore, type Store } from "back-core";

export default class extends SqlMigration {
	constructor(store: Store) {
		super("create_analytics_ip_sessions", store as SqlStore);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable("analytics_ip_sessions")
			.ifNotExists()
			.addColumn("session_key", "text", (column) => column.primaryKey())
			.addColumn("visitor_id", "text", (column) => column.notNull())
			.addColumn("session_id", "text", (column) => column.notNull())
			.addColumn("ip_address", "text", (column) => column.notNull())
			.addColumn("network", "text", (column) => column.notNull())
			.addColumn("country_code", "text", (column) => column.notNull())
			.addColumn("country_name", "text", (column) => column.notNull())
			.addColumn("region_name", "text", (column) => column.notNull())
			.addColumn("city_name", "text", (column) => column.notNull())
			.addColumn("asn", "integer", (column) => column.notNull())
			.addColumn("asn_organization", "text", (column) => column.notNull())
			.addColumn("user_type", "text", (column) => column.notNull())
			.addColumn("audience_type", "text", (column) => column.notNull())
			.addColumn("user_agent", "text", (column) => column.notNull())
			.addColumn("webdriver", "integer", (column) => column.notNull())
			.addColumn("user_activation", "integer", (column) => column.notNull())
			.addColumn("pointer_events", "integer", (column) => column.notNull())
			.addColumn("scroll_events", "integer", (column) => column.notNull())
			.addColumn("key_events", "integer", (column) => column.notNull())
			.addColumn("first_seen", "integer", (column) => column.notNull())
			.addColumn("last_seen", "integer", (column) => column.notNull())
			.addColumn("url", "text", (column) => column.notNull())
			.addColumn("page_views", "integer", (column) => column.notNull())
			.addColumn("clicks", "integer", (column) => column.notNull())
			.addColumn("visible_ms", "integer", (column) => column.notNull())
			.addColumn("hidden_ms", "integer", (column) => column.notNull())
			.addColumn("scroll_max", "real", (column) => column.notNull())
			.execute();
		await this.store.db.schema
			.createIndex("analytics_ip_sessions_last_seen_idx")
			.ifNotExists()
			.on("analytics_ip_sessions")
			.columns(["last_seen"])
			.execute();
		await this.store.db.schema
			.createIndex("analytics_ip_sessions_ip_idx")
			.ifNotExists()
			.on("analytics_ip_sessions")
			.columns(["ip_address"])
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema
			.dropIndex("analytics_ip_sessions_ip_idx")
			.ifExists()
			.execute();
		await this.store.db.schema
			.dropIndex("analytics_ip_sessions_last_seen_idx")
			.ifExists()
			.execute();
		await this.store.db.schema
			.dropTable("analytics_ip_sessions")
			.ifExists()
			.execute();
	}
}
