import {
	applyKyselyFilter,
	type KyselyFilterSchema,
	type SqlStore,
	sql,
} from "back-core";
import type {
	AnalyticsCountrySummary,
	AnalyticsEvent,
	AnalyticsEventInput,
	AnalyticsPageSummary,
	AnalyticsQueryParams,
	AnalyticsUriPageViewSummary,
	PaginatedResult,
} from "../../types";
import { siteTrafficCondition } from "../site-traffic";

const TABLE = "analytics_events";
type EventStore = { db: SqlStore["db"] };
const analyticsFilterSchema: KyselyFilterSchema = {
	event_type: {
		valueType: "string",
		operators: ["eq", "in", "contains"],
		column: "event_type",
	},
	audience_type: {
		valueType: "string",
		operators: ["eq", "in"],
		column: "audience_type",
	},
	content_type: {
		valueType: "string",
		operators: ["eq", "in"],
		column: "content_type",
	},
	content_id: {
		valueType: "string",
		operators: ["eq", "contains"],
		column: "content_id",
	},
	url: {
		valueType: "string",
		operators: ["eq", "contains", "startsWith"],
		column: "url",
	},
	visitor_id: { valueType: "string", operators: ["eq"], column: "visitor_id" },
	session_id: { valueType: "string", operators: ["eq"], column: "session_id" },
	country_code: {
		valueType: "string",
		operators: ["eq", "in"],
		column: "country_code",
	},
	ip_address: { valueType: "string", operators: ["eq"], column: "ip_address" },
	ts: {
		valueType: "number",
		operators: ["gt", "gte", "lt", "lte", "between"],
		column: "ts",
	},
};

function normalize(event: AnalyticsEventInput): AnalyticsEvent {
	return {
		ts: event.ts ?? Date.now(),
		visitor_id: event.visitor_id,
		session_id: event.session_id,
		event_type: event.event_type,
		audience_type: event.audience_type ?? "unknown",
		content_type: event.content_type ?? "",
		content_id: event.content_id ?? "",
		company_id: event.company_id ?? "",
		campaign_id: event.campaign_id ?? "",
		utm_source: event.utm_source ?? "",
		utm_medium: event.utm_medium ?? "",
		utm_campaign: event.utm_campaign ?? "",
		utm_term: event.utm_term ?? "",
		utm_content: event.utm_content ?? "",
		utm_id: event.utm_id ?? "",
		utm_source_platform: event.utm_source_platform ?? "",
		utm_creative_format: event.utm_creative_format ?? "",
		utm_marketing_tactic: event.utm_marketing_tactic ?? "",
		url: event.url,
		referrer: event.referrer ?? "",
		language: event.language ?? "",
		timezone: event.timezone ?? "",
		user_agent: event.user_agent ?? "",
		screen: event.screen ?? "",
		viewport: event.viewport ?? "",
		pixel_ratio: event.pixel_ratio ?? 0,
		touch_points: event.touch_points ?? 0,
		hardware_concurrency: event.hardware_concurrency ?? 0,
		device_memory: event.device_memory ?? 0,
		webdriver: event.webdriver ?? false,
		visible_ms: event.visible_ms ?? 0,
		hidden_ms: event.hidden_ms ?? 0,
		pointer_events: event.pointer_events ?? 0,
		pointer_distance: event.pointer_distance ?? 0,
		pointer_directions: event.pointer_directions ?? 0,
		scroll_events: event.scroll_events ?? 0,
		scroll_max: event.scroll_max ?? 0,
		trusted_clicks: event.trusted_clicks ?? 0,
		untrusted_clicks: event.untrusted_clicks ?? 0,
		key_events: event.key_events ?? 0,
		user_activation: event.user_activation ?? false,
		first_interaction_ms: event.first_interaction_ms ?? 0,
		ip_address: event.ip_address ?? "",
		country_code: event.country_code ?? "",
		country_name: event.country_name ?? "",
		region_name: event.region_name ?? "",
		city_name: event.city_name ?? "",
		asn: event.asn ?? 0,
		asn_organization: event.asn_organization ?? "",
	};
}

export class AnalyticsStoreService {
	constructor(private readonly store: EventStore) {}

	async insert(events: AnalyticsEventInput[]): Promise<void> {
		if (events.length === 0) return;
		const rows = events.map((input) => {
			const event = normalize(input);
			return {
				...event,
				webdriver: Number(event.webdriver),
				user_activation: Number(event.user_activation),
			};
		});
		for (let offset = 0; offset < rows.length; offset += 25) {
			await this.store.db
				.insertInto(TABLE)
				.values(rows.slice(offset, offset + 25))
				.execute();
		}
	}

	async list(
		params: AnalyticsQueryParams,
	): Promise<PaginatedResult<AnalyticsEvent>> {
		const apply = (query: any) => {
			let q = query;
			if (params.visitor_id) q = q.where("visitor_id", "=", params.visitor_id);
			if (params.session_id) q = q.where("session_id", "=", params.session_id);
			if (params.event_type) q = q.where("event_type", "=", params.event_type);
			if (params.audience_type)
				q = q.where("audience_type", "=", params.audience_type);
			if (params.content_type)
				q = q.where("content_type", "=", params.content_type);
			if (params.content_id) q = q.where("content_id", "=", params.content_id);
			if (params.url) q = q.where("url", "like", `%${params.url}%`);
			if (params.country_code)
				q = q.where("country_code", "=", params.country_code);
			if (params.ip_address) q = q.where("ip_address", "=", params.ip_address);
			if (params.from_ts !== undefined) q = q.where("ts", ">=", params.from_ts);
			if (params.to_ts !== undefined) q = q.where("ts", "<=", params.to_ts);
			return applyKyselyFilter(q, params.filter, analyticsFilterSchema);
		};
		const items = await apply(this.store.db.selectFrom(TABLE).selectAll())
			.orderBy("ts", "desc")
			.limit(params.limit ?? 100)
			.offset(params.offset ?? 0)
			.execute();
		const count = await apply(
			this.store.db
				.selectFrom(TABLE)
				.select(({ fn }) => fn.countAll().as("count")),
		).executeTakeFirst();
		return {
			items: (items as AnalyticsEvent[]).map((event) => ({
				...event,
				webdriver: Boolean(event.webdriver),
				user_activation: Boolean(event.user_activation),
			})),
			totalCount: Number(count?.count ?? 0),
		};
	}

	async todaySummary(fromTs: number): Promise<{
		page_views_today: number;
		session_ids: string[];
		visitor_ids: string[];
	}> {
		const [row, sessions, visitors] = await Promise.all([
			this.store.db
				.selectFrom(TABLE)
			.where(siteTrafficCondition())
				.select(({ fn }) => fn.countAll().as("page_views"))
				.where("event_type", "=", "page_view")
				.where("ts", ">=", fromTs)
				.executeTakeFirst(),
			this.store.db
				.selectFrom(TABLE)
			.where(siteTrafficCondition())
				.select("session_id")
				.distinct()
				.where("event_type", "=", "page_view")
				.where("ts", ">=", fromTs)
				.execute(),
			this.store.db
				.selectFrom(TABLE)
			.where(siteTrafficCondition())
				.select("visitor_id")
				.distinct()
				.where("event_type", "=", "page_view")
				.where("ts", ">=", fromTs)
				.execute(),
		]);
		return {
			page_views_today: Number(row?.page_views ?? 0),
			session_ids: sessions.map((session) => session.session_id),
			visitor_ids: visitors.map((visitor) => visitor.visitor_id),
		};
	}

	async realtimeRows(fromTs: number): Promise<
		Array<{
			ts: number;
			visitor_id: string;
			session_id: string;
			url: string;
			country_code: string;
			country_name: string;
		}>
	> {
		const rows = await this.store.db
			.selectFrom(TABLE)
			.where(siteTrafficCondition())
			.select([
				"ts",
				"visitor_id",
				"session_id",
				"url",
				"country_code",
				"country_name",
			])
			.where("ts", ">=", fromTs)
			.orderBy("ts", "desc")
			.limit(20_000)
			.execute();
		return rows as Array<{
			ts: number;
			visitor_id: string;
			session_id: string;
			url: string;
			country_code: string;
			country_name: string;
		}>;
	}

	async pageViewsByUri(fromTs: number): Promise<AnalyticsUriPageViewSummary[]> {
		const rows = await this.store.db
			.selectFrom(TABLE)
			.where(siteTrafficCondition())
			.select("url")
			.select(({ fn }) => fn.countAll().as("page_views"))
			.where("event_type", "=", "page_view")
			.where("ts", ">=", fromTs)
			.groupBy("url")
			.execute();
		return rows.map((row) => ({
			url: row.url,
			page_views: Number(row.page_views),
		}));
	}

	static realtimeSummary(
		rows: Array<{
			visitor_id: string;
			session_id: string;
			url: string;
			country_code: string;
			country_name: string;
		}>,
	): {
		active_sessions: number;
		active_visitors: number;
		active_pages: AnalyticsPageSummary[];
		active_countries: AnalyticsCountrySummary[];
	} {
		const latestBySession = new Map<string, (typeof rows)[number]>();
		for (const row of rows) {
			const previous = latestBySession.get(row.session_id);
			if (!previous || row.ts > previous.ts)
				latestBySession.set(row.session_id, row);
		}
		const visitors = new Set<string>();
		const pages = new Map<
			string,
			{ sessions: Set<string>; visitors: Set<string> }
		>();
		const countries = new Map<
			string,
			{ name: string; sessions: Set<string>; visitors: Set<string> }
		>();
		for (const row of latestBySession.values()) {
			visitors.add(row.visitor_id);
			const page = pages.get(row.url) ?? {
				sessions: new Set<string>(),
				visitors: new Set<string>(),
			};
			page.sessions.add(row.session_id);
			page.visitors.add(row.visitor_id);
			pages.set(row.url, page);
			const countryCode = row.country_code || "ZZ";
			const country = countries.get(countryCode) ?? {
				name:
					row.country_name || (countryCode === "ZZ" ? "Unknown" : countryCode),
				sessions: new Set<string>(),
				visitors: new Set<string>(),
			};
			country.sessions.add(row.session_id);
			country.visitors.add(row.visitor_id);
			countries.set(countryCode, country);
		}
		return {
			active_sessions: latestBySession.size,
			active_visitors: visitors.size,
			active_pages: [...pages.entries()]
				.map(([url, counts]) => ({
					url,
					sessions: counts.sessions.size,
					visitors: counts.visitors.size,
				}))
				.sort((left, right) => right.sessions - left.sessions),
			active_countries: [...countries.entries()]
				.map(([country_code, counts]) => ({
					country_code,
					country_name: counts.name,
					sessions: counts.sessions.size,
					visitors: counts.visitors.size,
				}))
				.sort((left, right) => right.sessions - left.sessions),
		};
	}

	async count(siteOnly = false): Promise<number> {
		let query = this.store.db
			.selectFrom(TABLE)
			.select(({ fn }) => fn.countAll().as("count"));
		if (siteOnly) query = query.where(siteTrafficCondition());
		const row = await query.executeTakeFirst();
		return Number(row?.count ?? 0);
	}

	async byEvent(): Promise<Record<string, number>> {
		const rows = await this.store.db
			.selectFrom(TABLE)
			.where(siteTrafficCondition())
			.select("event_type")
			.select(({ fn }) => fn.countAll().as("count"))
			.groupBy("event_type")
			.execute();
		return Object.fromEntries(
			rows.map((row) => [row.event_type, Number(row.count)]),
		);
	}

	async timeline(
		fromTs: number,
		bucketMs: number,
	): Promise<Array<{ timestamp: number; visits: number; events: number }>> {
		const bucket = sql<number>`CAST(ts / ${bucketMs} AS INTEGER) * ${bucketMs}`;
		const [events, visits] = await Promise.all([
			this.store.db
				.selectFrom(TABLE)
			.where(siteTrafficCondition())
				.select(bucket.as("timestamp"))
				.select(({ fn }) => fn.countAll().as("count"))
				.where("ts", ">=", fromTs)
				.groupBy(bucket)
				.execute(),
			this.store.db
				.selectFrom(TABLE)
			.where(siteTrafficCondition())
				.select(bucket.as("timestamp"))
				.select(({ fn }) => fn.count("session_id").distinct().as("count"))
				.where("event_type", "=", "page_view")
				.where("ts", ">=", fromTs)
				.groupBy(bucket)
				.execute(),
		]);
		const byTimestamp = new Map<number, { visits: number; events: number }>();
		for (const row of events) {
			byTimestamp.set(Number(row.timestamp), {
				visits: 0,
				events: Number(row.count),
			});
		}
		for (const row of visits) {
			const timestamp = Number(row.timestamp);
			const bucketStats = byTimestamp.get(timestamp) ?? {
				visits: 0,
				events: 0,
			};
			bucketStats.visits = Number(row.count);
			byTimestamp.set(timestamp, bucketStats);
		}
		return [...byTimestamp.entries()]
			.map(([timestamp, counts]) => ({ timestamp, ...counts }))
			.sort((left, right) => left.timestamp - right.timestamp);
	}

	async visitorSignals(fromTs: number): Promise<
		Array<{
			visitor_id: string;
			session_id: string;
			webdriver: number;
			user_activation: number;
			trusted_clicks: number;
			pointer_events: number;
			scroll_events: number;
			key_events: number;
			user_agent: string;
		}>
	> {
		const rows = await this.store.db
			.selectFrom(TABLE)
			.where(siteTrafficCondition())
			.select(["visitor_id", "session_id"])
			.select(({ fn }) => [
				fn.max<number>("webdriver").as("webdriver"),
				fn.max<number>("user_activation").as("user_activation"),
				fn.max<number>("trusted_clicks").as("trusted_clicks"),
				fn.max<number>("pointer_events").as("pointer_events"),
				fn.max<number>("scroll_events").as("scroll_events"),
				fn.max<number>("key_events").as("key_events"),
				fn.max<string>("user_agent").as("user_agent"),
			])
			.where("ts", ">=", fromTs)
			.groupBy(["visitor_id", "session_id"])
			.execute();
		return rows as Array<{
			visitor_id: string;
			session_id: string;
			webdriver: number;
			user_activation: number;
			trusted_clicks: number;
			pointer_events: number;
			scroll_events: number;
			key_events: number;
			user_agent: string;
		}>;
	}

	async moveOldestTo(
		target: AnalyticsStoreService,
		limit: number,
	): Promise<number> {
		const rows = (await this.store.db
			.selectFrom(TABLE)
			.selectAll()
			.select("rowid" as any)
			.orderBy("ts", "asc")
			.limit(limit)
			.execute()) as Array<AnalyticsEvent & { rowid: number }>;
		if (rows.length === 0) return 0;
		await target.insert(rows);
		await this.store.db
			.deleteFrom(TABLE)
			.where(
				"rowid" as any,
				"in",
				rows.map((row) => row.rowid),
			)
			.execute();
		return rows.length;
	}
}
