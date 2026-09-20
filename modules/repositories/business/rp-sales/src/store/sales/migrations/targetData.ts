import { SqlMigration, type SqlStore, sql } from "back-core";

/** Makes the target's render inputs explicit. `payload` remains untouched so
 * rows created by older deployments can still be read during the transition. */
export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("target_data", store);
	}

	async up(): Promise<void> {
		const columns: Array<[string, string]> = [
			["companyId", "text"],
			["templateId", "text"],
			["data", "text"],
		];
		for (const [name, type] of columns) {
			try {
				await this.store.db.schema
					.alterTable("outreach_targets")
					.addColumn(name, type, (column) => column.notNull().defaultTo(""))
					.execute();
			} catch {
				// The migration is safe to run against databases already upgraded.
			}
		}

		await sql`
			UPDATE outreach_targets
			   SET companyId = outreachId
			 WHERE companyId = ''
		`.execute(this.store.db);
		await sql`
			UPDATE outreach_targets
			   SET templateId = coalesce(
				(select templateId from outreaches where outreaches.id = outreach_targets.outreachId),
				''
			   )
			 WHERE templateId = ''
		`.execute(this.store.db);
		await sql`
			UPDATE outreach_targets
			   SET data = payload
			 WHERE data = ''
		`.execute(this.store.db);
	}

	async down(): Promise<void> {}
}
