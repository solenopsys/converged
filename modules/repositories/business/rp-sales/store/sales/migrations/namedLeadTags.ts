import { SqlMigration, type SqlStore, sql } from "back-core";

/**
 * Turns tags into named records and folds audiences into them.
 *
 * Before this, `lead_tags` held one row per (lead, tag name) and audiences were
 * a second, identical membership table that happened to carry a name. Two
 * mechanisms for one thing: an audience was a tag with a title. Now there is a
 * single one — `lead_tags` names the label, `lead_tag_links` says who carries
 * it — and audience identifiers survive as tag identifiers, so a campaign that
 * pointed at an audience keeps pointing at the same group.
 */
export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("named_lead_tags", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.alterTable("lead_tags")
			.renameTo("lead_tag_names_legacy")
			.execute();

		await this.store.db.schema
			.createTable("lead_tags")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("name", "text", (col) => col.notNull())
			.addColumn("description", "text", (col) => col.notNull().defaultTo(""))
			.addColumn("createdAt", "integer", (col) =>
				col.notNull().defaultTo(sql`(strftime('%s', 'now'))`),
			)
			.addColumn("updatedAt", "integer", (col) =>
				col.notNull().defaultTo(sql`(strftime('%s', 'now'))`),
			)
			.execute();

		await this.store.db.schema
			.createIndex("idx_lead_tags_name")
			.ifNotExists()
			.unique()
			.on("lead_tags")
			.column("name")
			.execute();

		await this.store.db.schema
			.createTable("lead_tag_links")
			.ifNotExists()
			.addColumn("tagId", "text", (col) => col.notNull())
			.addColumn("leadId", "text", (col) => col.notNull())
			.addColumn("createdAt", "integer", (col) =>
				col.notNull().defaultTo(sql`(strftime('%s', 'now'))`),
			)
			.addPrimaryKeyConstraint("pk_lead_tag_links", ["tagId", "leadId"])
			.execute();

		await this.store.db.schema
			.createIndex("idx_lead_tag_links_lead")
			.ifNotExists()
			.on("lead_tag_links")
			.column("leadId")
			.execute();

		// Audiences first: they already own an id a campaign refers to, so they
		// keep it. A tag of the same name is then the same record, not a rival.
		await sql`
      insert or ignore into lead_tags (id, name, description, createdAt, updatedAt)
      select id, name, description, createdAt, updatedAt from lead_audiences
    `.execute(this.store.db);

		await sql`
      insert or ignore into lead_tags (id, name, description, createdAt, updatedAt)
      select lower(hex(randomblob(16))), tagName, '', min(createdAt), min(createdAt)
      from lead_tag_names_legacy
      group by tagName
    `.execute(this.store.db);

		await sql`
      insert or ignore into lead_tag_links (tagId, leadId, createdAt)
      select tag.id, legacy.leadId, legacy.createdAt
      from lead_tag_names_legacy legacy
      join lead_tags tag on tag.name = legacy.tagName
    `.execute(this.store.db);

		await sql`
      insert or ignore into lead_tag_links (tagId, leadId, createdAt)
      select audienceId, leadId, createdAt from lead_audience_members
    `.execute(this.store.db);

		await this.store.db.schema
			.dropTable("lead_tag_names_legacy")
			.ifExists()
			.execute();
		await this.store.db.schema
			.dropTable("lead_audience_members")
			.ifExists()
			.execute();
		await this.store.db.schema.dropTable("lead_audiences").ifExists().execute();

		try {
			await this.store.db.schema
				.alterTable("outreaches")
				.renameColumn("audienceId", "tagId")
				.execute();
		} catch {
			// Databases built after the column was already renamed.
		}
	}

	async down(): Promise<void> {
		await this.store.db.schema.dropTable("lead_tag_links").ifExists().execute();
		await this.store.db.schema.dropTable("lead_tags").ifExists().execute();
	}
}
