import { afterEach, beforeEach, expect, it } from "bun:test";
import { Kysely } from "../../../../../../../core/backend/node_modules/kysely";
import { BunSqliteLocal } from "../../../../../../../core/backend/src/engines/sqlite/bun-sqlite-dialect";
import { isSiteUrl } from "../site-traffic";
import migrations from "./migrations/sql";
import { AnalyticsStoreService } from "./service";

let local: BunSqliteLocal;
let db: Kysely<Record<string, unknown>>;
let service: AnalyticsStoreService;

beforeEach(async () => {
	local = new BunSqliteLocal(":memory:");
	db = new Kysely({ dialect: local.dialect });
	for (const Migration of migrations) await new Migration({ db } as never).up();
	service = new AnalyticsStoreService({ db } as never);
});

afterEach(async () => {
	await db.destroy();
	local.close();
});

it("excludes console activity consistently from totals, timelines, and page counts", async () => {
	const urls = ["/console", "/console/mail", "/console?tab=mail", "/console#mail", "/ru/console", "/en/console/mail", "/", "/console-guide"];
	await service.insert(urls.map((url, index) => ({
		visitor_id: `visitor-${index}`,
		session_id: `session-${index}`,
		event_type: "page_view",
		url,
		ts: 100,
	})));
	expect(urls.filter(isSiteUrl)).toEqual(["/", "/console-guide"]);
	expect(await service.count(true)).toBe(2);
	expect(await service.count()).toBe(urls.length);
	expect(await service.byEvent()).toEqual({ page_view: 2 });
	expect(await service.todaySummary(0)).toEqual({ page_views_today: 2, session_ids: ["session-6", "session-7"], visitor_ids: ["visitor-6", "visitor-7"] });
	expect(await service.timeline(0, 1000)).toEqual([{ timestamp: 0, visits: 2, events: 2 }]);
	expect((await service.pageViewsByUri(0)).map((row) => row.url).sort()).toEqual(["/", "/console-guide"]);
	expect((await service.realtimeRows(0)).map((row) => row.url).sort()).toEqual(["/", "/console-guide"]);
	expect((await service.list({ offset: 0, limit: 100 })).totalCount).toBe(urls.length);
});
