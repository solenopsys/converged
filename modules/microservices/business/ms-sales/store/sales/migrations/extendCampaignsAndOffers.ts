import { SqlMigration, type SqlStore } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("extend_campaigns_and_offers", store);
	}

	async up(): Promise<void> {
		const columns: Array<[string, "text" | "integer", string | number | null]> =
			[
				["audienceId", "text", null],
				["templateId", "text", null],
				["planWorkflow", "text", ""],
				["sendWorkflow", "text", ""],
				["sendCronId", "text", null],
				["baseUrl", "text", ""],
				["demoUrl", "text", ""],
				["senders", "text", "{}"],
				["jitterMaxSeconds", "integer", 0],
			];
		for (const [name, type, defaultValue] of columns) {
			try {
				await this.store.db.schema
					.alterTable("outreaches")
					.addColumn(name, type, (col) =>
						defaultValue === null ? col : col.notNull().defaultTo(defaultValue),
					)
					.execute();
			} catch {
				// Supports databases already migrated by an earlier build.
			}
		}

		for (const [name, defaultValue] of [
			["name", ""],
			["subjectTemplate", ""],
			["bodyTemplate", ""],
		] as const) {
			try {
				await this.store.db.schema
					.alterTable("offers")
					.addColumn(name, "text", (col) =>
						col.notNull().defaultTo(defaultValue),
					)
					.execute();
			} catch {
				// Supports databases already migrated by an earlier build.
			}
		}
	}

	async down(): Promise<void> {}
}
