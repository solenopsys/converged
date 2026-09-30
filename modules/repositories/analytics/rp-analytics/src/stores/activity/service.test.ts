import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Kysely } from "../../../../../../../core/backend/node_modules/kysely";
import { BunSqliteLocal } from "../../../../../../../core/backend/src/engines/sqlite/bun-sqlite-dialect";
import CreateIpSessions from "./migrations/createIpSessions";
import { IpSessionsStoreService } from "./service";

describe("IpSessionsStoreService", () => {
	let local: BunSqliteLocal;
	let db: Kysely<Record<string, unknown>>;
	let service: IpSessionsStoreService;

	beforeEach(async () => {
		local = new BunSqliteLocal(":memory:");
		db = new Kysely({ dialect: local.dialect });
		await new CreateIpSessions({ db } as never).up();
		service = new IpSessionsStoreService({ db } as never);
	});

	afterEach(async () => {
		await db.destroy();
		local.close();
	});

	it("aggregates a session and retains known IP data", async () => {
		await service.record([
			{
				visitor_id: "visitor-1",
				session_id: "session-1",
				event_type: "page_view",
				ts: 100,
				url: "/",
				ip_address: "203.0.113.1",
				network: "203.0.113.0/24",
				country_code: "US",
				country_name: "United States",
				asn: 15169,
				asn_organization: "Google",
				audience_type: "external",
				user_agent: "Mozilla",
				pointer_events: 1,
				scroll_events: 1,
				trusted_clicks: 1,
				visible_ms: 1_000,
				scroll_max: 50,
			},
			{
				visitor_id: "visitor-1",
				session_id: "session-1",
				event_type: "activity",
				ts: 200,
				url: "/next",
				ip_address: "",
				user_agent: "",
				visible_ms: 1_000,
			},
			{
				visitor_id: "visitor-2",
				session_id: "session-2",
				event_type: "page_view",
				ts: 150,
				url: "/",
				user_agent: "ExampleCrawler/1.0",
			},
		]);

		const rows = await db
			.selectFrom("analytics_ip_sessions")
			.selectAll()
			.execute();
		expect(rows).toHaveLength(2);
		expect(rows.find((row) => row.visitor_id === "visitor-1")).toMatchObject({
			ip_address: "203.0.113.1",
			user_type: "human",
			audience_type: "external",
			page_views: 1,
			clicks: 1,
			visible_ms: 2_000,
			scroll_max: 50,
			url: "/next",
		});
		expect(await service.typeSummary(0)).toEqual({
			human: 1,
			bot: 1,
			unverified: 0,
		});
	});
});
