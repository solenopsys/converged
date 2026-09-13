import { SqlMigration, type SqlStore } from "back-core";

/**
 * The columns a review needs once it is part of a process rather than a guest
 * book entry: what work it is about, whether it has been published, who said
 * it back, and where the author went to say it again in public.
 *
 * Existing rows predate moderation, so they are backfilled as `published` —
 * they were readable before this migration and hiding them now would be a
 * change of meaning smuggled in as a schema change.
 */
export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("extend_reviews", store);
	}

	async up(): Promise<void> {
		const columns: Array<[string, "text" | "integer"]> = [
			["orderId", "text"],
			["requestId", "text"],
			["contact", "text"],
			["status", "text"],
			["source", "text"],
			["reply", "text"],
			["repliedAt", "text"],
			["repliedBy", "text"],
			["externalPlatform", "text"],
			["externalUrl", "text"],
			["publishedAt", "text"],
			["updatedAt", "text"],
		];

		for (const [name, type] of columns) {
			await this.store.db.schema
				.alterTable("reviews")
				.addColumn(name, type)
				.execute();
		}

		await this.store.db
			.updateTable("reviews" as never)
			.set({
				status: "published",
				updatedAt: new Date().toISOString(),
			} as never)
			.execute();

		await this.store.db.schema
			.createIndex("reviews_status_idx")
			.ifNotExists()
			.on("reviews")
			.column("status")
			.execute();
		await this.store.db.schema
			.createIndex("reviews_order_idx")
			.ifNotExists()
			.on("reviews")
			.column("orderId")
			.execute();
	}

	async down(): Promise<void> {}
}
