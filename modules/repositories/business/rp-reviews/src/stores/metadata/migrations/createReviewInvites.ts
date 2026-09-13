import { SqlMigration, type SqlStore, sql } from "back-core";

/**
 * One personal link per order, and the funnel that comes with it.
 *
 * The token is unique and indexed because the public form looks a link up by
 * nothing else; `orderId` is indexed because the outreach workflow's only
 * question is "which of these orders have already been asked".
 */
export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("create_review_invites", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable("review_invites")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("orderId", "text", (col) => col.notNull())
			.addColumn("token", "text", (col) => col.notNull().unique())
			.addColumn("contact", "text", (col) => col.notNull())
			.addColumn("lang", "text")
			.addColumn("status", "text", (col) => col.defaultTo("queued").notNull())
			.addColumn("sentAt", "text")
			.addColumn("openedAt", "text")
			.addColumn("answeredAt", "text")
			.addColumn("expiresAt", "text", (col) => col.notNull())
			.addColumn("followupCount", "integer", (col) =>
				col.defaultTo(0).notNull(),
			)
			.addColumn("lastFollowupAt", "text")
			.addColumn("reviewId", "text")
			.addColumn("error", "text")
			.addColumn("createdAt", "text", (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
			)
			.addColumn("updatedAt", "text", (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
			)
			.execute();

		await this.store.db.schema
			.createIndex("review_invites_token_idx")
			.ifNotExists()
			.on("review_invites")
			.column("token")
			.execute();
		await this.store.db.schema
			.createIndex("review_invites_order_idx")
			.ifNotExists()
			.on("review_invites")
			.column("orderId")
			.execute();
		await this.store.db.schema
			.createIndex("review_invites_status_idx")
			.ifNotExists()
			.on("review_invites")
			.column("status")
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema.dropTable("review_invites").ifExists().execute();
	}
}
