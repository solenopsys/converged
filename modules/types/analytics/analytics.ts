export type AnalyticsEvent = {
	ts: number;
	visitor_id: string;
	session_id: string;
	event_type: string;
	audience_type: "authenticated" | "external" | "unknown";
	content_type: string;
	content_id: string;
	company_id: string;
	campaign_id: string;
	url: string;
	referrer: string;
	language: string;
	timezone: string;
	user_agent: string;
	screen: string;
	viewport: string;
	pixel_ratio: number;
	touch_points: number;
	hardware_concurrency: number;
	device_memory: number;
	webdriver: boolean;
	visible_ms: number;
	hidden_ms: number;
	pointer_events: number;
	pointer_distance: number;
	pointer_directions: number;
	scroll_events: number;
	scroll_max: number;
	trusted_clicks: number;
	untrusted_clicks: number;
	key_events: number;
	user_activation: boolean;
	first_interaction_ms: number;
	ip_address: string;
	country_code: string;
	country_name: string;
	region_name: string;
	city_name: string;
	asn: number;
	asn_organization: string;
};

export type AnalyticsEventInput = Partial<AnalyticsEvent> & {
	visitor_id: string;
	session_id: string;
	event_type: string;
	url: string;
};

export type AnalyticsQueryParams = {
	offset: number;
	limit: number;
	visitor_id?: string;
	session_id?: string;
	event_type?: string;
	audience_type?: "authenticated" | "external" | "unknown";
	content_type?: string;
	content_id?: string;
	url?: string;
	country_code?: string;
	ip_address?: string;
	from_ts?: number;
	to_ts?: number;
	filter?: Record<string, unknown>;
};

export type AnalyticsFilterObject = Record<string, unknown>;

export type AnalyticsStatistic = {
	totalHot: number;
	totalCold: number;
	byEvent: Record<string, number>;
	dashboard: AnalyticsDashboardSummary;
	timeline: AnalyticsTimelineBucket[];
	humanTimeline: AnalyticsTimelineBucket[];
	botTimeline: AnalyticsTimelineBucket[];
	visitorTypes: AnalyticsVisitorTypeCounts;
	devices: AnalyticsDeviceCounts[];
	resolutions: AnalyticsResolutionCounts[];
	geoLiteDatabases: GeoLiteDatabaseStatus[];
};

export type AnalyticsDeviceCounts = {
	device_type: "mobile" | "tablet" | "desktop" | "unknown";
	human: number;
	bot: number;
	unverified: number;
};

export type AnalyticsResolutionCounts = {
	resolution: string;
	human: number;
	bot: number;
	unverified: number;
};

export type AnalyticsTimelineBucket = {
	timestamp: number;
	visits: number;
	events: number;
};

export type AnalyticsVisitorTypeCounts = {
	human: number;
	bot: number;
	unverified: number;
};

export type AnalyticsIpSession = {
	visitor_id: string;
	session_id: string;
	ip_address: string;
	network: string;
	country_code: string;
	country_name: string;
	region_name: string;
	city_name: string;
	asn: number;
	asn_organization: string;
	user_type: "human" | "bot" | "unverified";
	device_type: "mobile" | "tablet" | "desktop" | "unknown";
	screen: string;
	audience_type: "authenticated" | "external" | "unknown";
	url: string;
	first_seen: number;
	last_seen: number;
	page_views: number;
	clicks: number;
	visible_ms: number;
	scroll_max: number;
};

export type AnalyticsIpSessionPage = {
	items: AnalyticsIpSession[];
	totalCount: number;
};

export type GeoLiteCountryNetworkInput = {
	network: string;
	country_code?: string;
	country_name?: string;
	geoname_id?: number;
	registered_country_geoname_id?: number;
};

export type GeoLiteAsnNetworkInput = {
	network: string;
	asn: number;
	organization: string;
};

export type GeoLiteCityNetworkInput = {
	network: string;
	geoname_id?: number;
	registered_country_geoname_id?: number;
};

export type GeoLiteLocationInput = {
	dataset: "country" | "city";
	geoname_id: number;
	continent_code: string;
	continent_name: string;
	country_code: string;
	country_name: string;
	region_code: string;
	region_name: string;
	city_name: string;
	time_zone: string;
};

export type GeoLiteImportBatch = {
	importId: string;
	dataset: GeoLiteDataset;
	kind: "network" | "locations";
	ref: { cacheKey: string; sizeBytes?: number };
};

export type GeoLiteDataset = "country" | "city" | "asn";

export type GeoLiteDatabaseStatus = {
	dataset: GeoLiteDataset;
	records: number;
	updated_at: number;
};

export type GeoLiteDatabaseRow = {
	network: string;
	country_code: string;
	country_name: string;
	region_name: string;
	city_name: string;
	geoname_id: number | null;
	registered_country_geoname_id: number | null;
	asn: number | null;
	organization: string;
};

export type GeoLiteDatabasePage = {
	items: GeoLiteDatabaseRow[];
	totalCount: number;
};

export type AnalyticsPageSummary = {
	url: string;
	sessions: number;
	visitors: number;
};

export type AnalyticsUriPageViewSummary = {
	url: string;
	page_views: number;
};

export type AnalyticsCountrySummary = {
	country_code: string;
	country_name: string;
	sessions: number;
	visitors: number;
};

export type AnalyticsDashboardSummary = {
	page_views_today: number;
	visits_today: number;
	visitors_today: number;
	events_total: number;
	active_sessions: number;
	active_visitors: number;
	active_pages: AnalyticsPageSummary[];
	page_views_by_uri: AnalyticsUriPageViewSummary[];
	active_countries: AnalyticsCountrySummary[];
	updated_at: number;
};

export type AnalyticsSelectionField = {
	id: string;
	label: string;
	valueType: "string" | "number" | "boolean" | "date" | "enum";
	operators: string[];
};

export type AnalyticsSelectionDescriptor = {
	objectType: string;
	title: string;
	fields: AnalyticsSelectionField[];
	revision?: string;
};

export type AnalyticsSelectionStats = { totalCount: number };

export type PaginatedResult<T> = { items: T[]; totalCount?: number };

export interface AnalyticsService {
	write(event: AnalyticsEventInput): Promise<void>;
	writeBatch(events: AnalyticsEventInput[]): Promise<number>;
	listHot(
		params: AnalyticsQueryParams,
	): Promise<PaginatedResult<AnalyticsEvent>>;
	listCold(
		params: AnalyticsQueryParams,
	): Promise<PaginatedResult<AnalyticsEvent>>;
	getStatistic(): Promise<AnalyticsStatistic>;
	getDashboardSummary(): Promise<AnalyticsDashboardSummary>;
	listIpSessions(
		limit: number,
		offset: number,
		filter?: AnalyticsFilterObject,
	): Promise<AnalyticsIpSessionPage>;
	describeSelection(objectType: string): Promise<AnalyticsSelectionDescriptor>;
	inspectEvents(
		filter?: AnalyticsFilterObject,
	): Promise<AnalyticsSelectionStats>;
	importGeoLiteBatch(batch: GeoLiteImportBatch): Promise<number>;
	completeGeoLiteImport(
		dataset: GeoLiteDataset,
		importId: string,
	): Promise<number>;
	getGeoLiteDatabaseStatus(): Promise<GeoLiteDatabaseStatus[]>;
	listGeoLiteDatabase(
		dataset: GeoLiteDataset,
		limit: number,
		offset: number,
	): Promise<GeoLiteDatabasePage>;
	clearGeoLiteCountry(): Promise<void>;
	clearGeoLiteAsn(): Promise<void>;
	archiveHotToCold(): Promise<number>;
}
