import { SqlMigration, type SqlStore, sql } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("fill_touch_ids", store);
	}

	async up(): Promise<void> {
		const rows = (await this.store.db
			.selectFrom("touches")
			.select(sql<number>`rowid`.as("__rowid"))
			.where(sql<boolean>`id is null or id = ''`)
			.execute()) as Array<{ __rowid: number }>;

		for (const [index, row] of rows.entries()) {
			const id = `${Date.now()}${index.toString().padStart(3, "0")}`;
			await this.store.db
				.updateTable("touches")
				.set({ id })
				.where(sql<number>`rowid`, "=", row.__rowid)
				.execute();
		}
	}

	async down(): Promise<void> {}
}
