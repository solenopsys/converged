import { SqlMigration, type SqlStore, sql } from "back-core";
import { ACCESS_TAGS_TABLE } from "back-core";

/**
 * Backfills the tag relation for rows created before `AccessTagsMigration`.
 *
 * The relation appeared after the data: every lead, tag, offer and campaign
 * filed before it carries no rows in `access_tags`, so `visibleFrom()` joins
 * them away and the book reads empty while raw counts stay alive. New rows
 * are tagged at creation (`tagNew`: `authenticated` + `sales`), so this only
 * lifts the legacy ones to the same norm — two rows per object. Both are
 * needed: `sales` opens them to the team (group tag from the `tg` section of
 * `team.json`, riding the JWT), `authenticated` to anyone signed in, root
 * included — root's preset (`*: * = rwx`) grants methods but injects no group
 * tags, so without the `authenticated` row root would still see nothing.
 *
 * `NOT EXISTS` keeps it idempotent: on fresh stores it matches zero rows, on
 * re-run the primary key `(tag, objectId)` would swallow the rest anyway.
 */
export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("backfill_sales_access_tags", store);
	}

	async up(): Promise<void> {
		for (const table of ["leads", "lead_tags", "offers", "outreaches"]) {
			for (const tag of ["sales", "authenticated"]) {
				await sql.raw(
					`insert into "${ACCESS_TAGS_TABLE}" (tag, objectId) ` +
						`select '${tag}', "${table}".id from "${table}" ` +
						`where not exists (select 1 from "${ACCESS_TAGS_TABLE}" as t ` +
						`where t."objectId" = "${table}".id and t.tag = '${tag}')`,
				).execute(this.store.db);
			}
		}
	}

	async down(): Promise<void> {}
}
