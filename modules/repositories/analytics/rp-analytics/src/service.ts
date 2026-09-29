import { Access } from "nrpc";
import { StoresController } from "./stores";
import { AnalyticsStoreService } from "./stores/events/service";
import type {
	AnalyticsDashboardSummary,
	AnalyticsEventInput,
	AnalyticsQueryParams,
	AnalyticsSelectionDescriptor,
	AnalyticsSelectionStats,
	AnalyticsService,
	AnalyticsStatistic,
	GeoLiteAsnNetworkInput,
	GeoLiteCountryNetworkInput,
} from "./types";

const REPOSITORY_ID = "rp-analytics";
const ARCHIVE_BATCH_SIZE = 5_000;
const HOT_LIMIT = 50_000;
const HOUR_MS = 60 * 60 * 1000;
const TIMELINE_HOURS = 24;

export class AnalyticsServiceImpl implements AnalyticsService {
	stores!: StoresController;
	private readonly initPromise: Promise<void>;
	private archiveInProgress = false;
	private readonly geoCache = new Map<
		string,
		Promise<
			Pick<
				AnalyticsEventInput,
				"country_code" | "country_name" | "asn" | "asn_organization"
			>
		>
	>();

	constructor() {
		this.initPromise = this.init();
	}

	async init(): Promise<void> {
		this.stores = new StoresController(REPOSITORY_ID);
		await this.stores.init();
	}

	@Access("internal")
	async write(event: AnalyticsEventInput): Promise<void> {
		await this.writeBatch([event]);
	}

	@Access("internal")
	async writeBatch(events: AnalyticsEventInput[]): Promise<number> {
		if (events.length === 0) return 0;
		await this.ensureReady();
		const enriched = await Promise.all(
			events.map((event) => this.enrich(event)),
		);
		await this.stores.hot.insert(enriched);
		return enriched.length;
	}

	@Access("user")
	async listHot(params: AnalyticsQueryParams) {
		await this.ensureReady();
		return this.stores.hot.list(params);
	}

	@Access("user")
	async listCold(params: AnalyticsQueryParams) {
		await this.ensureReady();
		return this.stores.cold.list(params);
	}

	@Access("user")
	async getStatistic(): Promise<AnalyticsStatistic> {
		await this.ensureReady();
		const now = Date.now();
		const timelineStart =
			Math.floor(now / HOUR_MS) * HOUR_MS - (TIMELINE_HOURS - 1) * HOUR_MS;
		const today = new Date(now);
		today.setUTCHours(0, 0, 0, 0);
		const [
			hot,
			cold,
			hotEvents,
			coldEvents,
			hotTimeline,
			coldTimeline,
			hotSignals,
			coldSignals,
			dashboard,
		] = await Promise.all([
			this.stores.hot.count(),
			this.stores.cold.count(),
			this.stores.hot.byEvent(),
			this.stores.cold.byEvent(),
			this.stores.hot.timeline(timelineStart, HOUR_MS),
			this.stores.cold.timeline(timelineStart, HOUR_MS),
			this.stores.hot.visitorSignals(today.getTime()),
			this.stores.cold.visitorSignals(today.getTime()),
			this.getDashboardSummary(),
		]);
		const byEvent = { ...hotEvents };
		for (const [name, count] of Object.entries(coldEvents))
			byEvent[name] = (byEvent[name] ?? 0) + count;
		const timelineByHour = new Map<
			number,
			{ visits: number; events: number }
		>();
		for (const bucket of [...hotTimeline, ...coldTimeline]) {
			const current = timelineByHour.get(bucket.timestamp) ?? {
				visits: 0,
				events: 0,
			};
			current.visits += bucket.visits;
			current.events += bucket.events;
			timelineByHour.set(bucket.timestamp, current);
		}
		const timeline = Array.from({ length: TIMELINE_HOURS }, (_, index) => {
			const timestamp = timelineStart + index * HOUR_MS;
			return {
				timestamp,
				...(timelineByHour.get(timestamp) ?? { visits: 0, events: 0 }),
			};
		});
		const signals = new Map<string, (typeof hotSignals)[number]>();
		for (const signal of [...hotSignals, ...coldSignals]) {
			const key = `${signal.visitor_id}:${signal.session_id}`;
			const current = signals.get(key);
			if (!current) {
				signals.set(key, signal);
				continue;
			}
			for (const field of [
				"webdriver",
				"user_activation",
				"trusted_clicks",
				"pointer_events",
				"scroll_events",
				"key_events",
			] as const) {
				current[field] = Math.max(current[field], signal[field]);
			}
			if (signal.user_agent) current.user_agent = signal.user_agent;
		}
		const visitorTypes = { human: 0, bot: 0, unverified: 0 };
		for (const signal of signals.values()) {
			if (
				signal.webdriver > 0 ||
				/(bot|crawler|spider|headless|preview|lighthouse|phantom|slurp)/i.test(
					signal.user_agent,
				)
			) {
				visitorTypes.bot++;
			} else if (
				signal.user_activation > 0 ||
				signal.trusted_clicks > 0 ||
				signal.pointer_events > 0 ||
				signal.scroll_events > 0 ||
				signal.key_events > 0
			) {
				visitorTypes.human++;
			} else {
				visitorTypes.unverified++;
			}
		}
		return {
			totalHot: hot,
			totalCold: cold,
			byEvent,
			dashboard,
			timeline,
			visitorTypes,
		};
	}

	@Access("user")
	async getDashboardSummary(): Promise<AnalyticsDashboardSummary> {
		await this.ensureReady();
		const now = Date.now();
		const today = new Date(now);
		today.setUTCHours(0, 0, 0, 0);
		const realtimeSince = now - 5 * 60 * 1000;
		const uriStatsSince = now - 4 * 60 * 60 * 1000;
		const [
			hotToday,
			coldToday,
			hotRecent,
			coldRecent,
			hotCount,
			coldCount,
			hotUriViews,
			coldUriViews,
		] = await Promise.all([
			this.stores.hot.todaySummary(today.getTime()),
			this.stores.cold.todaySummary(today.getTime()),
			this.stores.hot.realtimeRows(realtimeSince),
			this.stores.cold.realtimeRows(realtimeSince),
			this.stores.hot.count(),
			this.stores.cold.count(),
			this.stores.hot.pageViewsByUri(uriStatsSince),
			this.stores.cold.pageViewsByUri(uriStatsSince),
		]);
		const realtime = AnalyticsStoreService.realtimeSummary([
			...hotRecent,
			...coldRecent,
		]);
		const sessionsToday = new Set([
			...hotToday.session_ids,
			...coldToday.session_ids,
		]);
		const visitorsToday = new Set([
			...hotToday.visitor_ids,
			...coldToday.visitor_ids,
		]);
		const pageViewsByUri = new Map<string, number>();
		for (const page of [...hotUriViews, ...coldUriViews]) {
			pageViewsByUri.set(
				page.url,
				(pageViewsByUri.get(page.url) ?? 0) + page.page_views,
			);
		}
		return {
			page_views_today: hotToday.page_views_today + coldToday.page_views_today,
			visits_today: sessionsToday.size,
			visitors_today: visitorsToday.size,
			events_total: hotCount + coldCount,
			...realtime,
			page_views_by_uri: [...pageViewsByUri.entries()]
				.map(([url, page_views]) => ({ url, page_views }))
				.sort((left, right) => right.page_views - left.page_views),
			updated_at: now,
		};
	}

	@Access("user")
	async describeSelection(
		objectType: string,
	): Promise<AnalyticsSelectionDescriptor> {
		if (objectType !== "analytics.event") {
			throw new Error(`Unsupported analytics selection object: ${objectType}`);
		}
		return {
			objectType,
			title: "Analytics events",
			fields: [
				{
					id: "event_type",
					label: "Event",
					valueType: "string",
					operators: ["eq", "contains"],
				},
				{
					id: "url",
					label: "Page",
					valueType: "string",
					operators: ["eq", "contains"],
				},
				{
					id: "visitor_id",
					label: "Visitor",
					valueType: "string",
					operators: ["eq"],
				},
				{
					id: "session_id",
					label: "Session",
					valueType: "string",
					operators: ["eq"],
				},
				{
					id: "country_code",
					label: "Country",
					valueType: "string",
					operators: ["eq"],
				},
				{
					id: "ts",
					label: "Timestamp",
					valueType: "number",
					operators: ["gt", "gte", "lt", "lte", "between"],
				},
			],
			revision: "analytics-events-v1",
		};
	}

	@Access("user")
	async inspectEvents(
		filter?: Record<string, unknown>,
	): Promise<AnalyticsSelectionStats> {
		await this.ensureReady();
		const params = { limit: 1, offset: 0, filter };
		const [hot, cold] = await Promise.all([
			this.stores.hot.list(params),
			this.stores.cold.list(params),
		]);
		return { totalCount: (hot.totalCount ?? 0) + (cold.totalCount ?? 0) };
	}

	@Access("internal")
	async importGeoLiteCountryBatch(
		rows: GeoLiteCountryNetworkInput[],
	): Promise<number> {
		await this.ensureReady();
		const count = await this.stores.geoCountry.importBatch(rows);
		this.geoCache.clear();
		return count;
	}

	@Access("internal")
	async importGeoLiteAsnBatch(rows: GeoLiteAsnNetworkInput[]): Promise<number> {
		await this.ensureReady();
		const count = await this.stores.geoAsn.importBatch(rows);
		this.geoCache.clear();
		return count;
	}

	@Access("internal")
	async clearGeoLiteCountry(): Promise<void> {
		await this.ensureReady();
		await this.stores.geoCountry.clear();
		this.geoCache.clear();
	}

	@Access("internal")
	async clearGeoLiteAsn(): Promise<void> {
		await this.ensureReady();
		await this.stores.geoAsn.clear();
		this.geoCache.clear();
	}

	@Access("internal")
	async archiveHotToCold(): Promise<number> {
		await this.ensureReady();
		if (this.archiveInProgress) return 0;
		this.archiveInProgress = true;
		try {
			let total = 0;
			while ((await this.stores.hot.count()) > HOT_LIMIT) {
				const moved = await this.stores.hot.moveOldestTo(
					this.stores.cold,
					ARCHIVE_BATCH_SIZE,
				);
				total += moved;
				if (moved < ARCHIVE_BATCH_SIZE) break;
			}
			return total;
		} finally {
			this.archiveInProgress = false;
		}
	}

	async destroy(): Promise<void> {
		await this.stores?.destroy();
	}

	private async ensureReady(): Promise<void> {
		await this.initPromise;
	}

	private async enrich(
		event: AnalyticsEventInput,
	): Promise<AnalyticsEventInput> {
		const ip = event.ip_address?.trim();
		if (!ip) return event;
		let lookup = this.geoCache.get(ip);
		if (!lookup) {
			lookup = Promise.all([
				this.stores.geoCountry.lookup(ip),
				this.stores.geoAsn.lookup(ip),
			]).then(([country, asn]) => ({
				country_code: country?.country_code ?? "",
				country_name: country?.country_name ?? "",
				asn: asn?.asn ?? 0,
				asn_organization: asn?.organization ?? "",
			}));
			this.geoCache.set(ip, lookup);
			if (this.geoCache.size > 20_000) {
				const oldest = this.geoCache.keys().next().value;
				if (oldest) this.geoCache.delete(oldest);
			}
		}
		return { ...event, ...(await lookup) };
	}
}
