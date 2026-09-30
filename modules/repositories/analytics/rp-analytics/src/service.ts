import type { CacheAdapter } from "back-core";
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
	GeoLiteCityNetworkInput,
	GeoLiteCountryNetworkInput,
	GeoLiteDatabaseRow,
	GeoLiteDatabaseStatus,
	GeoLiteDataset,
	GeoLiteImportBatch,
	GeoLiteLocationInput,
} from "./types";

const REPOSITORY_ID = "rp-analytics";
const ARCHIVE_BATCH_SIZE = 5_000;
const HOT_LIMIT = 50_000;
const HOUR_MS = 60 * 60 * 1000;
const TIMELINE_HOURS = 24;

export class AnalyticsServiceImpl implements AnalyticsService {
	stores!: StoresController;
	private readonly initPromise: Promise<void>;
	private readonly cache?: CacheAdapter;
	private archiveInProgress = false;
	private readonly geoCache = new Map<
		string,
		Promise<
			Pick<
				AnalyticsEventInput,
				| "country_code"
				| "country_name"
				| "region_name"
				| "city_name"
				| "asn"
				| "asn_organization"
			> & { network: string }
		>
	>();

	constructor(config?: { cache?: CacheAdapter }) {
		this.cache = config?.cache;
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
		await this.stores.ipSessions.record(enriched);
		const storedEvents = enriched
			.filter((event) => !isSessionSignal(event.event_type))
			.map((event) => ({
				...event,
				ip_address: "",
				country_code: "",
				country_name: "",
				region_name: "",
				city_name: "",
				asn: 0,
				asn_organization: "",
			}));
		await this.stores.hot.insert(storedEvents);
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
			visitorTypes,
			dashboard,
			geoLiteDatabases,
		] = await Promise.all([
			this.stores.hot.count(),
			this.stores.cold.count(),
			this.stores.hot.byEvent(),
			this.stores.cold.byEvent(),
			this.stores.hot.timeline(timelineStart, HOUR_MS),
			this.stores.cold.timeline(timelineStart, HOUR_MS),
			this.stores.ipSessions.typeSummary(today.getTime()),
			this.getDashboardSummary(),
			Promise.all([
				this.stores.geoCity.statusRow("country"),
				this.stores.geoCity.statusRow("city"),
				this.stores.geoCity.statusRow("asn"),
			]),
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
		return {
			totalHot: hot,
			totalCold: cold,
			byEvent,
			dashboard,
			timeline,
			visitorTypes,
			geoLiteDatabases,
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
			recentSessions,
			hotCount,
			coldCount,
			hotUriViews,
			coldUriViews,
		] = await Promise.all([
			this.stores.hot.todaySummary(today.getTime()),
			this.stores.cold.todaySummary(today.getTime()),
			this.stores.ipSessions.realtimeRows(realtimeSince),
			this.stores.hot.count(),
			this.stores.cold.count(),
			this.stores.hot.pageViewsByUri(uriStatsSince),
			this.stores.cold.pageViewsByUri(uriStatsSince),
		]);
		const realtime = AnalyticsStoreService.realtimeSummary(recentSessions);
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
	async listIpSessions(limit: number, offset: number) {
		await this.ensureReady();
		const safeLimit = Math.max(1, Math.min(500, Math.floor(limit || 100)));
		const safeOffset = Math.max(0, Math.floor(offset || 0));
		return this.stores.ipSessions.list(safeLimit, safeOffset);
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
					id: "audience_type",
					label: "Audience",
					valueType: "string",
					operators: ["eq"],
				},
				{
					id: "content_type",
					label: "Content type",
					valueType: "string",
					operators: ["eq"],
				},
				{
					id: "content_id",
					label: "Content block",
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
			revision: "analytics-events-v2",
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

	@Access("user")
	async importGeoLiteBatch(batch: GeoLiteImportBatch): Promise<number> {
		await this.ensureReady();
		const cache = this.cache;
		if (!cache) throw new Error("GeoLite batch cache is not configured");
		const cacheKey = batch.ref?.cacheKey;
		if (typeof cacheKey !== "string" || !cacheKey.trim()) {
			throw new Error("GeoLite batch cache reference is invalid");
		}
		const bytes = await cache.getBytes(cacheKey);
		if (!bytes)
			throw new Error("GeoLite batch cache entry is missing or expired");
		const rows = JSON.parse(new TextDecoder().decode(bytes));
		if (!Array.isArray(rows) || rows.length > 1_000) {
			throw new Error("GeoLite cache entry must contain at most 1000 rows");
		}

		let imported: number;
		if (batch.kind === "locations") {
			if (batch.dataset === "asn") {
				throw new Error("ASN imports do not contain location rows");
			}
			imported = await this.stores.geoCity.importLocationsBatch(
				batch.importId,
				batch.dataset,
				rows as GeoLiteLocationInput[],
			);
		} else if (batch.dataset === "country") {
			imported = await this.stores.geoCountry.importBatch(
				batch.importId,
				rows as GeoLiteCountryNetworkInput[],
			);
		} else if (batch.dataset === "city") {
			imported = await this.stores.geoCity.importNetworkBatch(
				batch.importId,
				rows as GeoLiteCityNetworkInput[],
			);
		} else {
			imported = await this.stores.geoAsn.importBatch(
				batch.importId,
				rows as GeoLiteAsnNetworkInput[],
			);
		}
		await cache.del(batch.ref.cacheKey);
		return imported;
	}

	@Access("user")
	async completeGeoLiteImport(
		dataset: GeoLiteDataset,
		importId: string,
	): Promise<number> {
		await this.ensureReady();
		let records: number;
		if (dataset === "country") {
			records = await this.stores.geoCountry.completeImport(importId);
			await this.stores.geoCity.completeLocations("country", importId);
		} else if (dataset === "city") {
			records = await this.stores.geoCity.completeNetworks(importId);
			await this.stores.geoCity.completeLocations("city", importId);
		} else {
			records = await this.stores.geoAsn.completeImport(importId);
		}
		await this.stores.geoCity.saveStatus(dataset, records);
		this.geoCache.clear();
		return records;
	}

	@Access("user")
	async getGeoLiteDatabaseStatus(): Promise<GeoLiteDatabaseStatus[]> {
		await this.ensureReady();
		return Promise.all([
			this.stores.geoCity.statusRow("country"),
			this.stores.geoCity.statusRow("city"),
			this.stores.geoCity.statusRow("asn"),
		]);
	}

	@Access("user")
	async listGeoLiteDatabase(
		dataset: GeoLiteDataset,
		limit: number,
		offset: number,
	): Promise<{ items: GeoLiteDatabaseRow[]; totalCount: number }> {
		await this.ensureReady();
		const safeLimit = Math.max(1, Math.min(500, Math.floor(limit || 100)));
		const safeOffset = Math.max(0, Math.floor(offset || 0));
		if (dataset === "country") {
			const page = await this.stores.geoCountry.list(safeLimit, safeOffset);
			return {
				totalCount: page.totalCount,
				items: page.items.map((row) => ({
					network: row.network,
					country_code: row.country_code ?? "",
					country_name: row.country_name ?? "",
					region_name: "",
					city_name: "",
					geoname_id: row.geoname_id,
					registered_country_geoname_id: row.registered_country_geoname_id,
					asn: null,
					organization: "",
				})),
			};
		}
		if (dataset === "city") {
			const page = await this.stores.geoCity.list(safeLimit, safeOffset);
			return {
				totalCount: page.totalCount,
				items: page.items.map((row) => ({
					network: row.network,
					country_code: row.country_code ?? "",
					country_name: row.country_name ?? "",
					region_name: row.region_name ?? "",
					city_name: row.city_name ?? "",
					geoname_id: row.geoname_id,
					registered_country_geoname_id: row.registered_country_geoname_id,
					asn: null,
					organization: "",
				})),
			};
		}
		const page = await this.stores.geoAsn.list(safeLimit, safeOffset);
		return {
			totalCount: page.totalCount,
			items: page.items.map((row) => ({
				network: row.network,
				country_code: "",
				country_name: "",
				region_name: "",
				city_name: "",
				geoname_id: null,
				registered_country_geoname_id: null,
				asn: row.asn,
				organization: row.organization,
			})),
		};
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
	): Promise<AnalyticsEventInput & { network?: string }> {
		const ip = event.ip_address?.trim();
		if (!ip) return event;
		let lookup = this.geoCache.get(ip);
		if (!lookup) {
			lookup = Promise.all([
				this.stores.geoCountry.lookup(ip),
				this.stores.geoCity.lookup(ip),
				this.stores.geoAsn.lookup(ip),
			]).then(async ([countryNetwork, cityNetwork, asn]) => {
				const countryLocationId =
					countryNetwork?.geoname_id ??
					countryNetwork?.registered_country_geoname_id;
				const [countryLocation, cityLocation] = await Promise.all([
					countryNetwork?.country_code
						? undefined
						: countryLocationId
							? this.stores.geoCity.lookupLocation("country", countryLocationId)
							: undefined,
					cityNetwork?.geoname_id
						? this.stores.geoCity.lookupLocation("city", cityNetwork.geoname_id)
						: undefined,
				]);
				return {
					country_code:
						cityLocation?.country_code ??
						countryLocation?.country_code ??
						countryNetwork?.country_code ??
						"",
					country_name:
						cityLocation?.country_name ??
						countryLocation?.country_name ??
						countryNetwork?.country_name ??
						"",
					region_name: cityLocation?.region_name ?? "",
					city_name: cityLocation?.city_name ?? "",
					network:
						asn?.network ??
						countryNetwork?.network ??
						cityNetwork?.network ??
						"",
					asn: asn?.asn ?? 0,
					asn_organization: asn?.organization ?? "",
				};
			});
			this.geoCache.set(ip, lookup);
			if (this.geoCache.size > 20_000) {
				const oldest = this.geoCache.keys().next().value;
				if (oldest) this.geoCache.delete(oldest);
			}
		}
		return { ...event, ...(await lookup) };
	}
}

function isSessionSignal(eventType: string): boolean {
	return ["activity", "pointer", "scroll", "key", "visibility"].includes(
		eventType,
	);
}
