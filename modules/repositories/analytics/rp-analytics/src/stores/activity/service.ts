import {
	applyKyselyFilter,
	type KyselyFilterSchema,
	type SqlStore,
	sql,
} from "back-core";
import type {
	AnalyticsDeviceCounts,
	AnalyticsEventInput,
	AnalyticsFilterObject,
	AnalyticsIpSession,
} from "../../../types";
import { siteTrafficCondition } from "../site-traffic";

const TABLE = "analytics_ip_sessions";
const UTM_FIELDS = [
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_term",
	"utm_content",
	"utm_id",
	"utm_source_platform",
	"utm_creative_format",
	"utm_marketing_tactic",
] as const;
const ipSessionFilterSchema: KyselyFilterSchema = {
	ip_address: {
		valueType: "string",
		operators: ["eq", "contains"],
		column: "ip_address",
	},
	network: {
		valueType: "string",
		operators: ["eq", "contains"],
		column: "network",
	},
	country_name: {
		valueType: "string",
		operators: ["eq", "contains"],
		column: "country_name",
	},
	city_name: {
		valueType: "string",
		operators: ["eq", "contains"],
		column: "city_name",
	},
	user_type: {
		valueType: "string",
		operators: ["eq", "in"],
		column: "user_type",
	},
	device_type: {
		valueType: "string",
		operators: ["eq", "in"],
		column: "device_type",
	},
	screen: {
		valueType: "string",
		operators: ["eq", "contains"],
		column: "screen",
	},
	url: {
		valueType: "string",
		operators: ["eq", "contains", "startsWith"],
		column: "url",
	},
	utm_source: {
		valueType: "string",
		operators: ["eq", "contains"],
		column: "utm_source",
	},
};
const BOT_AGENT =
	/(bot|crawler|spider|headless|preview|lighthouse|phantom|slurp)/i;

type EnrichedEvent = AnalyticsEventInput & { network?: string };
type SessionBatch = Omit<AnalyticsIpSession, "user_type"> & {
	session_key: string;
	user_type: AnalyticsIpSession["user_type"];
	user_agent: string;
	device_type: "mobile" | "tablet" | "desktop" | "unknown";
	screen: string;
	webdriver: number;
	user_activation: number;
	pointer_events: number;
	scroll_events: number;
	key_events: number;
	hidden_ms: number;
};

export class IpSessionsStoreService {
	constructor(private readonly store: SqlStore) {}

	async record(events: EnrichedEvent[]): Promise<void> {
		const batches = new Map<string, SessionBatch>();
		for (const event of events) {
			const key = JSON.stringify([event.visitor_id, event.session_id]);
			const ts = event.ts ?? Date.now();
			const current = batches.get(key);
			const interaction =
				(event.pointer_events ?? 0) > 0 ||
				(event.scroll_events ?? 0) > 0 ||
				(event.key_events ?? 0) > 0 ||
				(event.trusted_clicks ?? 0) > 0 ||
				(event.user_activation ?? false);
			const detectedType =
				event.webdriver || BOT_AGENT.test(event.user_agent ?? "")
					? "bot"
					: interaction
						? "human"
						: "unverified";
			const deviceType = classifyDevice(
				event.user_agent ?? "",
				event.screen ?? "",
				event.touch_points ?? 0,
			);
			const next: SessionBatch = current ?? {
				session_key: key,
				visitor_id: event.visitor_id,
				session_id: event.session_id,
				ip_address: event.ip_address ?? "",
				network: event.network ?? "",
				country_code: event.country_code ?? "",
				country_name: event.country_name ?? "",
				region_name: event.region_name ?? "",
				city_name: event.city_name ?? "",
				asn: event.asn ?? 0,
				asn_organization: event.asn_organization ?? "",
				user_type: detectedType,
				audience_type: event.audience_type ?? "unknown",
				user_agent: event.user_agent ?? "",
				device_type: deviceType,
				screen: event.screen ?? "",
				webdriver: Number(event.webdriver ?? false),
				user_activation: Number(event.user_activation ?? false),
				pointer_events: event.pointer_events ?? 0,
				scroll_events: event.scroll_events ?? 0,
				key_events: event.key_events ?? 0,
				first_seen: ts,
				last_seen: ts,
				url: event.url,
				utm_source: event.utm_source ?? "",
				utm_medium: event.utm_medium ?? "",
				utm_campaign: event.utm_campaign ?? "",
				utm_term: event.utm_term ?? "",
				utm_content: event.utm_content ?? "",
				utm_id: event.utm_id ?? "",
				utm_source_platform: event.utm_source_platform ?? "",
				utm_creative_format: event.utm_creative_format ?? "",
				utm_marketing_tactic: event.utm_marketing_tactic ?? "",
				page_views: Number(event.event_type === "page_view"),
				event_count: Number(!isSessionSignal(event.event_type)),
				clicks: (event.trusted_clicks ?? 0) + (event.untrusted_clicks ?? 0),
				visible_ms: event.visible_ms ?? 0,
				hidden_ms: event.hidden_ms ?? 0,
				scroll_max: event.scroll_max ?? 0,
			};
			if (current) {
				current.first_seen = Math.min(current.first_seen, ts);
				current.last_seen = Math.max(current.last_seen, ts);
				if (ts >= current.last_seen) {
					current.url = event.url;
					for (const field of UTM_FIELDS) {
						if (event[field]) current[field] = event[field];
					}
					if (event.audience_type && event.audience_type !== "unknown") {
						current.audience_type = event.audience_type;
					}
					current.user_agent = event.user_agent || current.user_agent;
					current.device_type =
						deviceType === "unknown" ? current.device_type : deviceType;
					current.screen = event.screen || current.screen;
					current.ip_address = event.ip_address || current.ip_address;
					current.network = event.network || current.network;
					current.country_code = event.country_code || current.country_code;
					current.country_name = event.country_name || current.country_name;
					current.region_name = event.region_name || current.region_name;
					current.city_name = event.city_name || current.city_name;
					current.asn = event.asn || current.asn;
					current.asn_organization =
						event.asn_organization || current.asn_organization;
				}
				current.user_type = mergeUserType(current.user_type, detectedType);
				current.webdriver = Math.max(
					current.webdriver,
					Number(event.webdriver ?? false),
				);
				current.user_activation = Math.max(
					current.user_activation,
					Number(event.user_activation ?? false),
				);
				current.pointer_events += event.pointer_events ?? 0;
				current.scroll_events += event.scroll_events ?? 0;
				current.key_events += event.key_events ?? 0;
				current.page_views += Number(event.event_type === "page_view");
				current.event_count += Number(!isSessionSignal(event.event_type));
				current.clicks +=
					(event.trusted_clicks ?? 0) + (event.untrusted_clicks ?? 0);
				current.visible_ms += event.visible_ms ?? 0;
				current.hidden_ms += event.hidden_ms ?? 0;
				current.scroll_max = Math.max(
					current.scroll_max,
					event.scroll_max ?? 0,
				);
			} else {
				batches.set(key, next);
			}
		}

		const rows = [...batches.values()];
		for (let offset = 0; offset < rows.length; offset += 50) {
			await this.store.db
				.insertInto(TABLE)
				.values(rows.slice(offset, offset + 50))
				.onConflict((conflict) =>
					conflict.column("session_key").doUpdateSet({
						ip_address: sql`COALESCE(NULLIF(excluded.ip_address, ''), ${sql.ref(`${TABLE}.ip_address`)})`,
						network: sql`COALESCE(NULLIF(excluded.network, ''), ${sql.ref(`${TABLE}.network`)})`,
						country_code: sql`COALESCE(NULLIF(excluded.country_code, ''), ${sql.ref(`${TABLE}.country_code`)})`,
						country_name: sql`COALESCE(NULLIF(excluded.country_name, ''), ${sql.ref(`${TABLE}.country_name`)})`,
						region_name: sql`COALESCE(NULLIF(excluded.region_name, ''), ${sql.ref(`${TABLE}.region_name`)})`,
						city_name: sql`COALESCE(NULLIF(excluded.city_name, ''), ${sql.ref(`${TABLE}.city_name`)})`,
						asn: sql`CASE WHEN excluded.asn > 0 THEN excluded.asn ELSE ${sql.ref(`${TABLE}.asn`)} END`,
						asn_organization: sql`COALESCE(NULLIF(excluded.asn_organization, ''), ${sql.ref(`${TABLE}.asn_organization`)})`,
						user_type: sql`CASE WHEN ${sql.ref(`${TABLE}.user_type`)} = 'bot' OR excluded.user_type = 'bot' THEN 'bot' WHEN ${sql.ref(`${TABLE}.user_type`)} = 'human' OR excluded.user_type = 'human' THEN 'human' ELSE 'unverified' END`,
						audience_type: sql`COALESCE(NULLIF(excluded.audience_type, 'unknown'), ${sql.ref(`${TABLE}.audience_type`)})`,
						user_agent: sql`COALESCE(NULLIF(excluded.user_agent, ''), ${sql.ref(`${TABLE}.user_agent`)})`,
						device_type: sql`CASE WHEN excluded.device_type = 'unknown' THEN ${sql.ref(`${TABLE}.device_type`)} ELSE excluded.device_type END`,
						screen: sql`COALESCE(NULLIF(excluded.screen, ''), ${sql.ref(`${TABLE}.screen`)})`,
						webdriver: sql`MAX(${sql.ref(`${TABLE}.webdriver`)}, excluded.webdriver)`,
						user_activation: sql`MAX(${sql.ref(`${TABLE}.user_activation`)}, excluded.user_activation)`,
						pointer_events: sql`(${sql.ref(`${TABLE}.pointer_events`)} + excluded.pointer_events)`,
						scroll_events: sql`(${sql.ref(`${TABLE}.scroll_events`)} + excluded.scroll_events)`,
						key_events: sql`(${sql.ref(`${TABLE}.key_events`)} + excluded.key_events)`,
						first_seen: sql`MIN(${sql.ref(`${TABLE}.first_seen`)}, excluded.first_seen)`,
						last_seen: sql`MAX(${sql.ref(`${TABLE}.last_seen`)}, excluded.last_seen)`,
						url: sql`CASE WHEN excluded.last_seen >= ${sql.ref(`${TABLE}.last_seen`)} THEN excluded.url ELSE ${sql.ref(`${TABLE}.url`)} END`,
						utm_source: sql`COALESCE(NULLIF(excluded.utm_source, ''), ${sql.ref(`${TABLE}.utm_source`)})`,
						utm_medium: sql`COALESCE(NULLIF(excluded.utm_medium, ''), ${sql.ref(`${TABLE}.utm_medium`)})`,
						utm_campaign: sql`COALESCE(NULLIF(excluded.utm_campaign, ''), ${sql.ref(`${TABLE}.utm_campaign`)})`,
						utm_term: sql`COALESCE(NULLIF(excluded.utm_term, ''), ${sql.ref(`${TABLE}.utm_term`)})`,
						utm_content: sql`COALESCE(NULLIF(excluded.utm_content, ''), ${sql.ref(`${TABLE}.utm_content`)})`,
						utm_id: sql`COALESCE(NULLIF(excluded.utm_id, ''), ${sql.ref(`${TABLE}.utm_id`)})`,
						utm_source_platform: sql`COALESCE(NULLIF(excluded.utm_source_platform, ''), ${sql.ref(`${TABLE}.utm_source_platform`)})`,
						utm_creative_format: sql`COALESCE(NULLIF(excluded.utm_creative_format, ''), ${sql.ref(`${TABLE}.utm_creative_format`)})`,
						utm_marketing_tactic: sql`COALESCE(NULLIF(excluded.utm_marketing_tactic, ''), ${sql.ref(`${TABLE}.utm_marketing_tactic`)})`,
						page_views: sql`(${sql.ref(`${TABLE}.page_views`)} + excluded.page_views)`,
						event_count: sql`(${sql.ref(`${TABLE}.event_count`)} + excluded.event_count)`,
						clicks: sql`(${sql.ref(`${TABLE}.clicks`)} + excluded.clicks)`,
						visible_ms: sql`(${sql.ref(`${TABLE}.visible_ms`)} + excluded.visible_ms)`,
						hidden_ms: sql`(${sql.ref(`${TABLE}.hidden_ms`)} + excluded.hidden_ms)`,
						scroll_max: sql`MAX(${sql.ref(`${TABLE}.scroll_max`)}, excluded.scroll_max)`,
					}),
				)
				.execute();
		}
	}

	async typeSummary(fromTs: number) {
		const rows = await this.store.db
			.selectFrom(TABLE)
			.where(siteTrafficCondition())
			.select("user_type")
			.select(({ fn }) => fn.countAll().as("count"))
			.where("last_seen", ">=", fromTs)
			.groupBy("user_type")
			.execute();
		return {
			human: Number(rows.find((row) => row.user_type === "human")?.count ?? 0),
			bot: Number(rows.find((row) => row.user_type === "bot")?.count ?? 0),
			unverified: Number(
				rows.find((row) => row.user_type === "unverified")?.count ?? 0,
			),
		};
	}

	async deviceSummary(fromTs: number) {
		const counts = [
			sql<number>`COUNT(DISTINCT visitor_id)`.as("visitors"),
			sql<number>`SUM(CASE WHEN user_type = 'human' THEN 1 ELSE 0 END)`.as("human"),
			sql<number>`SUM(CASE WHEN user_type = 'bot' THEN 1 ELSE 0 END)`.as("bot"),
			sql<number>`SUM(CASE WHEN user_type = 'unverified' THEN 1 ELSE 0 END)`.as("unverified"),
		];
		const [deviceRows, resolutionRows] = await Promise.all([
			this.store.db.selectFrom(TABLE)
			.where(siteTrafficCondition())
				.select("device_type").select(counts)
				.where("last_seen", ">=", fromTs)
				.groupBy("device_type").execute(),
			this.store.db.selectFrom(TABLE)
			.where(siteTrafficCondition())
				.select("screen").select(counts)
				.where("last_seen", ">=", fromTs)
				.where("screen", "<>", "")
				.groupBy("screen").execute(),
		]);
		const numbers = (row: { visitors: number; human: number; bot: number; unverified: number }) => ({
			visitors: Number(row.visitors),
			human: Number(row.human),
			bot: Number(row.bot),
			unverified: Number(row.unverified),
		});
		return {
			devices: deviceRows.map((row) => ({
				device_type: (row.device_type || "unknown") as AnalyticsDeviceCounts["device_type"],
				...numbers(row),
			})).sort((a, b) => a.device_type.localeCompare(b.device_type)),
			resolutions: resolutionRows.map((row) => ({
				resolution: row.screen,
				...numbers(row),
			})).sort((a, b) => b.visitors - a.visitors).slice(0, 12),
		};
	}

	async timeline(
		fromTs: number,
		bucketMs: number,
		userType: AnalyticsIpSession["user_type"],
	): Promise<Array<{ timestamp: number; visits: number; events: number }>> {
		const bucket = sql<number>`CAST(first_seen / ${bucketMs} AS INTEGER) * ${bucketMs}`;
		const rows = await this.store.db
			.selectFrom(TABLE)
			.where(siteTrafficCondition())
			.select(bucket.as("timestamp"))
			.select(({ fn }) => [
				fn.countAll().as("visits"),
				fn.sum<number>("page_views").as("events"),
			])
			.where("first_seen", ">=", fromTs)
			.where("user_type", "=", userType)
			.groupBy(bucket)
			.execute();
		return rows.map((row) => ({
			timestamp: Number(row.timestamp),
			visits: Number(row.visits),
			events: Number(row.events ?? 0),
		}));
	}

	async realtimeRows(fromTs: number) {
		return this.store.db
			.selectFrom(TABLE)
			.where(siteTrafficCondition())
			.select([
				"visitor_id",
				"session_id",
				"url",
				"country_code",
				"country_name",
			])
			.where("last_seen", ">=", fromTs)
			.orderBy("last_seen", "desc")
			.limit(20_000)
			.execute();
	}

	async list(limit: number, offset: number, filter?: AnalyticsFilterObject) {
		const apply = (query: any) =>
			applyKyselyFilter(
				query.where("ip_address", "<>", ""),
				filter,
				ipSessionFilterSchema,
			);
		const [items, total] = await Promise.all([
			apply(
				this.store.db
					.selectFrom(TABLE)
					.select([
						"visitor_id",
						"session_id",
						"ip_address",
						"network",
						"country_code",
						"country_name",
						"region_name",
						"city_name",
						"asn",
						"asn_organization",
						"user_type",
						"device_type",
						"screen",
						"audience_type",
						"url",
						"first_seen",
						"last_seen",
						"page_views",
						"event_count",
						"clicks",
						"visible_ms",
						"scroll_max",
					]),
			)
				.orderBy("last_seen", "desc")
				.limit(limit)
				.offset(offset)
				.execute(),
			apply(
				this.store.db
					.selectFrom(TABLE)
					.select(({ fn }) => fn.countAll().as("count")),
			).executeTakeFirst(),
		]);
		return {
			items: items as AnalyticsIpSession[],
			totalCount: Number(total?.count ?? 0),
		};
	}
}

function classifyDevice(
	userAgent: string,
	screen: string,
	touchPoints: number,
): "mobile" | "tablet" | "desktop" | "unknown" {
	if (/ipad|tablet|kindle|silk/i.test(userAgent)) return "tablet";
	if (/mobi|iphone|ipod|windows phone|android.*mobile/i.test(userAgent))
		return "mobile";
	if (/android/i.test(userAgent)) return "tablet";
	if (/macintosh/i.test(userAgent) && touchPoints > 1) return "tablet";
	if (/windows|macintosh|x11|linux/i.test(userAgent)) return "desktop";
	const dimensions = screen.match(/^(\d+)x(\d+)$/);
	if (touchPoints > 0 && dimensions) {
		const shortestSide = Math.min(Number(dimensions[1]), Number(dimensions[2]));
		return shortestSide < 800 ? "mobile" : "tablet";
	}
	return "unknown";
}

function mergeUserType(
	current: AnalyticsIpSession["user_type"],
	next: AnalyticsIpSession["user_type"],
): AnalyticsIpSession["user_type"] {
	if (current === "bot" || next === "bot") return "bot";
	if (current === "human" || next === "human") return "human";
	return "unverified";
}

function isSessionSignal(eventType: string): boolean {
	return ["activity", "pointer", "scroll", "key", "visibility"].includes(
		eventType,
	);
}
