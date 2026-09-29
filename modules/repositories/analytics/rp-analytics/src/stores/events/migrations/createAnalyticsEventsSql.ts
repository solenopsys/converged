import { SqlMigration, SqlStore, type Store } from "back-core";

export default class extends SqlMigration {
	constructor(store: Store) {
		super("create_analytics_events", store as SqlStore);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable("analytics_events")
			.ifNotExists()
			.addColumn("ts", "integer", (col) => col.notNull())
			.addColumn("visitor_id", "text", (col) => col.notNull())
			.addColumn("session_id", "text", (col) => col.notNull())
			.addColumn("event_type", "text", (col) => col.notNull())
			.addColumn("company_id", "text", (col) => col.notNull())
			.addColumn("campaign_id", "text", (col) => col.notNull())
			.addColumn("url", "text", (col) => col.notNull())
			.addColumn("referrer", "text", (col) => col.notNull())
			.addColumn("language", "text", (col) => col.notNull())
			.addColumn("timezone", "text", (col) => col.notNull())
			.addColumn("user_agent", "text", (col) => col.notNull())
			.addColumn("screen", "text", (col) => col.notNull())
			.addColumn("viewport", "text", (col) => col.notNull())
			.addColumn("pixel_ratio", "real", (col) => col.notNull())
			.addColumn("touch_points", "integer", (col) => col.notNull())
			.addColumn("hardware_concurrency", "integer", (col) => col.notNull())
			.addColumn("device_memory", "real", (col) => col.notNull())
			.addColumn("webdriver", "integer", (col) => col.notNull())
			.addColumn("visible_ms", "integer", (col) => col.notNull())
			.addColumn("hidden_ms", "integer", (col) => col.notNull())
			.addColumn("pointer_events", "integer", (col) => col.notNull())
			.addColumn("pointer_distance", "real", (col) => col.notNull())
			.addColumn("pointer_directions", "integer", (col) => col.notNull())
			.addColumn("scroll_events", "integer", (col) => col.notNull())
			.addColumn("scroll_max", "real", (col) => col.notNull())
			.addColumn("trusted_clicks", "integer", (col) => col.notNull())
			.addColumn("untrusted_clicks", "integer", (col) => col.notNull())
			.addColumn("key_events", "integer", (col) => col.notNull())
			.addColumn("user_activation", "integer", (col) => col.notNull())
			.addColumn("first_interaction_ms", "integer", (col) => col.notNull())
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema
			.dropTable("analytics_events")
			.ifExists()
			.execute();
	}
}
