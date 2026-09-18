import { SqlStore, SqlMigration } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("create_support", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable("tickets")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("number", "integer", (col) => col.notNull().unique())
			.addColumn("type", "text", (col) => col.notNull())
			.addColumn("title", "text", (col) => col.notNull())
			.addColumn("status", "text", (col) => col.notNull())
			.addColumn("authorId", "text", (col) => col.notNull())
			.addColumn("threadId", "text", (col) => col.notNull())
			.addColumn("votes", "integer", (col) => col.notNull().defaultTo(0))
			.addColumn("createdAt", "text", (col) => col.notNull())
			.addColumn("updatedAt", "text", (col) => col.notNull())
			.execute();

		// The feature rating: newest-first and most-liked-first within a type.
		await this.store.db.schema
			.createIndex("tickets_type_votes_idx")
			.ifNotExists()
			.on("tickets")
			.columns(["type", "votes"])
			.execute();

		// "My tickets" is the other list anybody opens.
		await this.store.db.schema
			.createIndex("tickets_author_idx")
			.ifNotExists()
			.on("tickets")
			.columns(["authorId", "createdAt"])
			.execute();

		// One person, one like — the pair is the key, so a second like is a
		// collision rather than a second row, whatever order two clicks arrive in.
		await this.store.db.schema
			.createTable("ticket_votes")
			.ifNotExists()
			.addColumn("ticketId", "text", (col) => col.notNull())
			.addColumn("userId", "text", (col) => col.notNull())
			.addColumn("at", "text", (col) => col.notNull())
			.addPrimaryKeyConstraint("ticket_votes_pk", ["ticketId", "userId"])
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema.dropTable("ticket_votes").ifExists().execute();
		await this.store.db.schema.dropIndex("tickets_author_idx").ifExists().execute();
		await this.store.db.schema.dropIndex("tickets_type_votes_idx").ifExists().execute();
		await this.store.db.schema.dropTable("tickets").ifExists().execute();
	}
}
