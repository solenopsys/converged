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

	it("separates browser counts from repeated sessions at the same resolution", async () => {
		await service.record(Array.from({ length: 4 }, (_, index) => ({
			visitor_id: "same-browser",
			session_id: `tab-${index}`,
			event_type: "page_view",
			ts: 100,
			url: "/",
			user_agent: "Mozilla/5.0 (X11; Linux x86_64)",
			screen: "1920x1080",
			trusted_clicks: index < 3 ? 1 : 0,
		})));
		const summary = await service.deviceSummary(0);
		expect(summary.devices).toEqual([
			{ device_type: "desktop", visitors: 1, human: 3, bot: 0, unverified: 1 },
		]);
		expect(summary.resolutions).toEqual([
			{ resolution: "1920x1080", visitors: 1, human: 3, bot: 0, unverified: 1 },
		]);
	});

	it("excludes historical console sessions from every site summary", async () => {
		const urls = ["/console", "/console/mail", "/console?tab=mail", "/console#mail", "/ru/console", "/en/console/mail", "/", "/console-guide"];
		await service.record(urls.map((url, index) => ({
			visitor_id: `visitor-${index}`,
			session_id: `session-${index}`,
			event_type: "page_view",
			ts: 100,
			url,
			ip_address: "203.0.113.1",
			user_agent: "Mozilla/5.0 (X11; Linux x86_64)",
			screen: "1920x1080",
			trusted_clicks: 1,
		})));
		expect(await service.typeSummary(0)).toEqual({ human: 2, bot: 0, unverified: 0 });
		expect((await service.deviceSummary(0)).devices[0]).toMatchObject({ visitors: 2, human: 2 });
		expect(await service.timeline(0, 1000, "human")).toEqual([{ timestamp: 0, visits: 2, events: 2 }]);
		expect((await service.realtimeRows(0)).map((row) => row.url).sort()).toEqual(["/", "/console-guide"]);
		expect((await service.list(100, 0)).totalCount).toBe(urls.length);
	});

	it("recognizes iPad desktop user agents and Android tablets", async () => {
		await service.record([
			{ visitor_id: "ipad", session_id: "ipad", event_type: "page_view", url: "/", user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Safari/605.1.15", touch_points: 5, screen: "1024x1366", trusted_clicks: 1 },
			{ visitor_id: "android", session_id: "android", event_type: "page_view", url: "/", user_agent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36", screen: "800x1280", trusted_clicks: 1 },
		]);
		expect((await service.deviceSummary(0)).devices).toEqual([{ device_type: "tablet", visitors: 2, human: 2, bot: 0, unverified: 0 }]);
	});
});
