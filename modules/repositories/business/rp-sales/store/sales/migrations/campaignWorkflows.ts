import { SqlMigration, type SqlStore, sql } from "back-core";

/**
 * A campaign stops being a pile of send settings and becomes five answers.
 *
 * `baseUrl`, `demoUrl`, `senders` and `jitterMaxSeconds` were columns because
 * the delivery workflow read them one by one. They are parameters of that
 * workflow, not properties of a campaign — so they move into `sendParams`,
 * where the workflow's own JSON Schema validates them and draws their form.
 * The same for `tagId`, which was the one audience shape the old planner could
 * express; `audience` now carries any lead predicate.
 *
 * The old columns are left in place rather than dropped: SQLite rewrites the
 * whole table to drop one, and nothing reads them any more.
 */
export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("campaign_workflows", store);
	}

	async up(): Promise<void> {
		const columns: Array<[string, "text", string]> = [
			["audience", "text", "{}"],
			["enrichWorkflow", "text", ""],
			["enrichParams", "text", "{}"],
			["sendParams", "text", "{}"],
		];
		for (const [name, type, defaultValue] of columns) {
			try {
				await this.store.db.schema
					.alterTable("outreaches")
					.addColumn(name, type, (col) => col.notNull().defaultTo(defaultValue))
					.execute();
			} catch {
				// Supports databases already migrated by an earlier build.
			}
		}

		// A campaign that pointed at a tag keeps pointing at the same leads.
		try {
			await sql`
				UPDATE outreaches
				   SET audience = json_object('tags', json_array(tagId))
				 WHERE tagId IS NOT NULL AND tagId <> '' AND audience = '{}'
			`.execute(this.store.db);
		} catch {
			// Older rows may not carry a tag at all.
		}
	}

	async down(): Promise<void> {}
}
