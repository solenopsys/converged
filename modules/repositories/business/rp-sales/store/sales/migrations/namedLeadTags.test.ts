import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore, sql } from "back-core";
import migrations from "./index";
import NamedLeadTags from "./namedLeadTags";

/** The conversion is one-way and runs against live data, so it is checked on a
 *  database built by every migration that came before it. */
describe("named_lead_tags migration", () => {
	let store: SqlStore;

	beforeEach(async () => {
		store = new SqlStore(
			":memory:",
			migrations.slice(0, -1),
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
	});

	const rows = async <T>(query: string): Promise<T[]> =>
		(await sql<T>`${sql.raw(query)}`.execute(store.db)).rows as T[];

	it("folds audiences and bare tag names into one named tag", async () => {
		await sql`insert into leads (id, createdAt, description, lang, type, catalogId, disabled)
      values ('lead-1', 1, 'One', 'en', 'cnc', 'c1', 0), ('lead-2', 1, 'Two', 'it', 'cnc', 'c2', 0)`.execute(
			store.db,
		);
		await sql`insert into lead_tags (leadId, tagName, createdAt)
      values ('lead-1', 'batch-7', 10), ('lead-2', 'batch-7', 11), ('lead-1', 'Italy', 12)`.execute(
			store.db,
		);
		await sql`insert into lead_audiences (id, name, description, createdAt, updatedAt)
      values ('aud-1', 'Italy', 'Italian shops', 20, 20)`.execute(store.db);
		await sql`insert into lead_audience_members (audienceId, leadId, createdAt)
      values ('aud-1', 'lead-2', 21)`.execute(store.db);
		await sql`insert into outreaches (id, name, status, lang, description, createdAt, updatedAt, audienceId)
      values ('out-1', 'Campaign', 'draft', 'it', '', 30, 30, 'aud-1')`.execute(
			store.db,
		);

		await new NamedLeadTags(store).up();

		const tags = await rows<{ id: string; name: string; description: string }>(
			"select id, name, description from lead_tags order by name",
		);
		expect(tags.map((tag) => tag.name)).toEqual(["Italy", "batch-7"]);
		// The audience keeps its identifier, so the campaign still points at it.
		expect(tags[0]).toMatchObject({ id: "aud-1", description: "Italian shops" });

		const links = await rows<{ name: string; leadId: string }>(
			`select tag.name as name, link.leadId as leadId
       from lead_tag_links link join lead_tags tag on tag.id = link.tagId
       order by tag.name, link.leadId`,
		);
		expect(links).toEqual([
			// The tag named Italy and the audience named Italy are now one group.
			{ name: "Italy", leadId: "lead-1" },
			{ name: "Italy", leadId: "lead-2" },
			{ name: "batch-7", leadId: "lead-1" },
			{ name: "batch-7", leadId: "lead-2" },
		]);

		const [outreach] = await rows<{ tagId: string }>(
			"select tagId from outreaches",
		);
		expect(outreach.tagId).toBe("aud-1");
	});
});
