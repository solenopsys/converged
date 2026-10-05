import { SqlMigration, type SqlStore, type Store } from "back-core";

export default class extends SqlMigration {
	constructor(store: Store) {
		super("add_analytics_events_session_idx", store as SqlStore);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createIndex("analytics_events_session_visitor_ts_idx")
			.ifNotExists()
			.on("analytics_events")
			.columns(["session_id", "visitor_id", "ts"])
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema
			.dropIndex("analytics_events_session_visitor_ts_idx")
			.ifExists()
			.execute();
	}
}
