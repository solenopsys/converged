import { SqlMigration, type SqlStore, sql } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("add_touch_company_name", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.alterTable("touches")
			.addColumn("companyName", "text")
			.execute();

		await sql`
			update touches
			set companyName = case
				when coalesce(
					case
						when cast(createdAt as integer) > 1000000000 then cast(createdAt as integer)
						else unixepoch(createdAt)
					end,
					0
				) < unixepoch('2026-06-01 00:00:00')
					then 'catalog_autreach'
				else 'saas_autreach'
			end
			where companyName is null or companyName = ''
		`.execute(this.store.db);

		await this.store.db.schema
			.createIndex("idx_touches_company_name_contact")
			.ifNotExists()
			.on("touches")
			.columns(["companyName", "contactId"])
			.execute();
	}

	async down(): Promise<void> {}
}
