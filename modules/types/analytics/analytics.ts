export type AnalyticsEvent = {
	ts: number;
	visitor_id: string;
	session_id: string;
	event_type: string;
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
	visitorTypes: AnalyticsVisitorTypeCounts;
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

export type GeoLiteCountryNetworkInput = {
	network: string;
	country_code: string;
	country_name?: string;
};

export type GeoLiteAsnNetworkInput = {
	network: string;
	asn: number;
	organization: string;
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
	describeSelection(objectType: string): Promise<AnalyticsSelectionDescriptor>;
	inspectEvents(
		filter?: AnalyticsFilterObject,
	): Promise<AnalyticsSelectionStats>;
	importGeoLiteCountryBatch(
		rows: GeoLiteCountryNetworkInput[],
	): Promise<number>;
	importGeoLiteAsnBatch(rows: GeoLiteAsnNetworkInput[]): Promise<number>;
	clearGeoLiteCountry(): Promise<void>;
	clearGeoLiteAsn(): Promise<void>;
	archiveHotToCold(): Promise<number>;
}
