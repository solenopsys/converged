// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

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
	visitors?: number;
	human: number;
	bot: number;
	unverified: number;
};

export type AnalyticsResolutionCounts = {
	resolution: string;
	visitors?: number;
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
	event_count: number;
	clicks: number;
	visible_ms: number;
	scroll_max: number;
};

export type AnalyticsIpSessionPage = {
	items: Array<AnalyticsIpSession & { id: string; duration_seconds: number }>;
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

export const metadata: ServiceMetadata = {
  "interfaceName": "AnalyticsService",
  "serviceName": "analytics",
  "filePath": "analytics/analytics.ts",
  "methods": [
    {
      "name": "write",
      "parameters": [
        {
          "name": "event",
          "type": "AnalyticsEventInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "writeBatch",
      "parameters": [
        {
          "name": "events",
          "type": "AnalyticsEventInput",
          "optional": false,
          "isArray": true
        }
      ],
      "returnType": "number",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listHot",
      "parameters": [
        {
          "name": "params",
          "type": "AnalyticsQueryParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<AnalyticsEvent>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listCold",
      "parameters": [
        {
          "name": "params",
          "type": "AnalyticsQueryParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<AnalyticsEvent>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getStatistic",
      "parameters": [],
      "returnType": "AnalyticsStatistic",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getDashboardSummary",
      "parameters": [],
      "returnType": "AnalyticsDashboardSummary",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listIpSessions",
      "parameters": [
        {
          "name": "limit",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "offset",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "filter",
          "type": "AnalyticsFilterObject",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "AnalyticsIpSessionPage",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "describeSelection",
      "parameters": [
        {
          "name": "objectType",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "AnalyticsSelectionDescriptor",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "inspectEvents",
      "parameters": [
        {
          "name": "filter",
          "type": "AnalyticsFilterObject",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "AnalyticsSelectionStats",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "importGeoLiteBatch",
      "parameters": [
        {
          "name": "batch",
          "type": "GeoLiteImportBatch",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "number",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "completeGeoLiteImport",
      "parameters": [
        {
          "name": "dataset",
          "type": "GeoLiteDataset",
          "optional": false,
          "isArray": false
        },
        {
          "name": "importId",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "number",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getGeoLiteDatabaseStatus",
      "parameters": [],
      "returnType": "GeoLiteDatabaseStatus",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "listGeoLiteDatabase",
      "parameters": [
        {
          "name": "dataset",
          "type": "GeoLiteDataset",
          "optional": false,
          "isArray": false
        },
        {
          "name": "limit",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "offset",
          "type": "number",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "GeoLiteDatabasePage",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "clearGeoLiteCountry",
      "parameters": [],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "clearGeoLiteAsn",
      "parameters": [],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "archiveHotToCold",
      "parameters": [],
      "returnType": "number",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "AnalyticsEvent",
      "kind": "type",
      "definition": "{\n\tts: number;\n\tvisitor_id: string;\n\tsession_id: string;\n\tevent_type: string;\n\taudience_type: \"authenticated\" | \"external\" | \"unknown\";\n\tcontent_type: string;\n\tcontent_id: string;\n\tcompany_id: string;\n\tcampaign_id: string;\n\turl: string;\n\treferrer: string;\n\tlanguage: string;\n\ttimezone: string;\n\tuser_agent: string;\n\tscreen: string;\n\tviewport: string;\n\tpixel_ratio: number;\n\ttouch_points: number;\n\thardware_concurrency: number;\n\tdevice_memory: number;\n\twebdriver: boolean;\n\tvisible_ms: number;\n\thidden_ms: number;\n\tpointer_events: number;\n\tpointer_distance: number;\n\tpointer_directions: number;\n\tscroll_events: number;\n\tscroll_max: number;\n\ttrusted_clicks: number;\n\tuntrusted_clicks: number;\n\tkey_events: number;\n\tuser_activation: boolean;\n\tfirst_interaction_ms: number;\n\tip_address: string;\n\tcountry_code: string;\n\tcountry_name: string;\n\tregion_name: string;\n\tcity_name: string;\n\tasn: number;\n\tasn_organization: string;\n}"
    },
    {
      "name": "AnalyticsEventInput",
      "kind": "type",
      "definition": "Partial<AnalyticsEvent> & {\n\tvisitor_id: string;\n\tsession_id: string;\n\tevent_type: string;\n\turl: string;\n}"
    },
    {
      "name": "AnalyticsQueryParams",
      "kind": "type",
      "definition": "{\n\toffset: number;\n\tlimit: number;\n\tvisitor_id?: string;\n\tsession_id?: string;\n\tevent_type?: string;\n\taudience_type?: \"authenticated\" | \"external\" | \"unknown\";\n\tcontent_type?: string;\n\tcontent_id?: string;\n\turl?: string;\n\tcountry_code?: string;\n\tip_address?: string;\n\tfrom_ts?: number;\n\tto_ts?: number;\n\tfilter?: Record<string, unknown>;\n}"
    },
    {
      "name": "AnalyticsFilterObject",
      "kind": "type",
      "definition": "Record<string, unknown>"
    },
    {
      "name": "AnalyticsStatistic",
      "kind": "type",
      "definition": "{\n\ttotalHot: number;\n\ttotalCold: number;\n\tbyEvent: Record<string, number>;\n\tdashboard: AnalyticsDashboardSummary;\n\ttimeline: AnalyticsTimelineBucket[];\n\thumanTimeline: AnalyticsTimelineBucket[];\n\tbotTimeline: AnalyticsTimelineBucket[];\n\tvisitorTypes: AnalyticsVisitorTypeCounts;\n\tdevices: AnalyticsDeviceCounts[];\n\tresolutions: AnalyticsResolutionCounts[];\n\tgeoLiteDatabases: GeoLiteDatabaseStatus[];\n}"
    },
    {
      "name": "AnalyticsDeviceCounts",
      "kind": "type",
      "definition": "{\n\tdevice_type: \"mobile\" | \"tablet\" | \"desktop\" | \"unknown\";\n\tvisitors?: number;\n\thuman: number;\n\tbot: number;\n\tunverified: number;\n}"
    },
    {
      "name": "AnalyticsResolutionCounts",
      "kind": "type",
      "definition": "{\n\tresolution: string;\n\tvisitors?: number;\n\thuman: number;\n\tbot: number;\n\tunverified: number;\n}"
    },
    {
      "name": "AnalyticsTimelineBucket",
      "kind": "type",
      "definition": "{\n\ttimestamp: number;\n\tvisits: number;\n\tevents: number;\n}"
    },
    {
      "name": "AnalyticsVisitorTypeCounts",
      "kind": "type",
      "definition": "{\n\thuman: number;\n\tbot: number;\n\tunverified: number;\n}"
    },
    {
      "name": "AnalyticsIpSession",
      "kind": "type",
      "definition": "{\n\tvisitor_id: string;\n\tsession_id: string;\n\tip_address: string;\n\tnetwork: string;\n\tcountry_code: string;\n\tcountry_name: string;\n\tregion_name: string;\n\tcity_name: string;\n\tasn: number;\n\tasn_organization: string;\n\tuser_type: \"human\" | \"bot\" | \"unverified\";\n\tdevice_type: \"mobile\" | \"tablet\" | \"desktop\" | \"unknown\";\n\tscreen: string;\n\taudience_type: \"authenticated\" | \"external\" | \"unknown\";\n\turl: string;\n\tfirst_seen: number;\n\tlast_seen: number;\n\tpage_views: number;\n\tevent_count: number;\n\tclicks: number;\n\tvisible_ms: number;\n\tscroll_max: number;\n}"
    },
    {
      "name": "AnalyticsIpSessionPage",
      "kind": "type",
      "definition": "{\n\titems: Array<AnalyticsIpSession & { id: string; duration_seconds: number }>;\n\ttotalCount: number;\n}"
    },
    {
      "name": "GeoLiteCountryNetworkInput",
      "kind": "type",
      "definition": "{\n\tnetwork: string;\n\tcountry_code?: string;\n\tcountry_name?: string;\n\tgeoname_id?: number;\n\tregistered_country_geoname_id?: number;\n}"
    },
    {
      "name": "GeoLiteAsnNetworkInput",
      "kind": "type",
      "definition": "{\n\tnetwork: string;\n\tasn: number;\n\torganization: string;\n}"
    },
    {
      "name": "GeoLiteCityNetworkInput",
      "kind": "type",
      "definition": "{\n\tnetwork: string;\n\tgeoname_id?: number;\n\tregistered_country_geoname_id?: number;\n}"
    },
    {
      "name": "GeoLiteLocationInput",
      "kind": "type",
      "definition": "{\n\tdataset: \"country\" | \"city\";\n\tgeoname_id: number;\n\tcontinent_code: string;\n\tcontinent_name: string;\n\tcountry_code: string;\n\tcountry_name: string;\n\tregion_code: string;\n\tregion_name: string;\n\tcity_name: string;\n\ttime_zone: string;\n}"
    },
    {
      "name": "GeoLiteImportBatch",
      "kind": "type",
      "definition": "{\n\timportId: string;\n\tdataset: GeoLiteDataset;\n\tkind: \"network\" | \"locations\";\n\tref: { cacheKey: string; sizeBytes?: number };\n}"
    },
    {
      "name": "GeoLiteDataset",
      "kind": "type",
      "definition": "\"country\" | \"city\" | \"asn\""
    },
    {
      "name": "GeoLiteDatabaseStatus",
      "kind": "type",
      "definition": "{\n\tdataset: GeoLiteDataset;\n\trecords: number;\n\tupdated_at: number;\n}"
    },
    {
      "name": "GeoLiteDatabaseRow",
      "kind": "type",
      "definition": "{\n\tnetwork: string;\n\tcountry_code: string;\n\tcountry_name: string;\n\tregion_name: string;\n\tcity_name: string;\n\tgeoname_id: number | null;\n\tregistered_country_geoname_id: number | null;\n\tasn: number | null;\n\torganization: string;\n}"
    },
    {
      "name": "GeoLiteDatabasePage",
      "kind": "type",
      "definition": "{\n\titems: GeoLiteDatabaseRow[];\n\ttotalCount: number;\n}"
    },
    {
      "name": "AnalyticsPageSummary",
      "kind": "type",
      "definition": "{\n\turl: string;\n\tsessions: number;\n\tvisitors: number;\n}"
    },
    {
      "name": "AnalyticsUriPageViewSummary",
      "kind": "type",
      "definition": "{\n\turl: string;\n\tpage_views: number;\n}"
    },
    {
      "name": "AnalyticsCountrySummary",
      "kind": "type",
      "definition": "{\n\tcountry_code: string;\n\tcountry_name: string;\n\tsessions: number;\n\tvisitors: number;\n}"
    },
    {
      "name": "AnalyticsDashboardSummary",
      "kind": "type",
      "definition": "{\n\tpage_views_today: number;\n\tvisits_today: number;\n\tvisitors_today: number;\n\tevents_total: number;\n\tactive_sessions: number;\n\tactive_visitors: number;\n\tactive_pages: AnalyticsPageSummary[];\n\tpage_views_by_uri: AnalyticsUriPageViewSummary[];\n\tactive_countries: AnalyticsCountrySummary[];\n\tupdated_at: number;\n}"
    },
    {
      "name": "AnalyticsSelectionField",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tlabel: string;\n\tvalueType: \"string\" | \"number\" | \"boolean\" | \"date\" | \"enum\";\n\toperators: string[];\n}"
    },
    {
      "name": "AnalyticsSelectionDescriptor",
      "kind": "type",
      "definition": "{\n\tobjectType: string;\n\ttitle: string;\n\tfields: AnalyticsSelectionField[];\n\trevision?: string;\n}"
    },
    {
      "name": "AnalyticsSelectionStats",
      "kind": "type",
      "definition": "{ totalCount: number }"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{ items: T[]; totalCount?: number }"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface AnalyticsService {
  write(event: AnalyticsEventInput): Promise<void>;
  writeBatch(events: AnalyticsEventInput[]): Promise<number>;
  listHot(params: AnalyticsQueryParams): Promise<PaginatedResult<AnalyticsEvent>>;
  listCold(params: AnalyticsQueryParams): Promise<PaginatedResult<AnalyticsEvent>>;
  getStatistic(): Promise<AnalyticsStatistic>;
  getDashboardSummary(): Promise<AnalyticsDashboardSummary>;
  listIpSessions(limit: number, offset: number, filter?: AnalyticsFilterObject): Promise<AnalyticsIpSessionPage>;
  describeSelection(objectType: string): Promise<AnalyticsSelectionDescriptor>;
  inspectEvents(filter?: AnalyticsFilterObject): Promise<AnalyticsSelectionStats>;
  importGeoLiteBatch(batch: GeoLiteImportBatch): Promise<number>;
  completeGeoLiteImport(dataset: GeoLiteDataset, importId: string): Promise<number>;
  getGeoLiteDatabaseStatus(): Promise<GeoLiteDatabaseStatus[]>;
  listGeoLiteDatabase(dataset: GeoLiteDataset, limit: number, offset: number): Promise<GeoLiteDatabasePage>;
  clearGeoLiteCountry(): Promise<void>;
  clearGeoLiteAsn(): Promise<void>;
  archiveHotToCold(): Promise<number>;
}

// Client interface
export interface AnalyticsServiceClient {
  write(event: AnalyticsEventInput): Promise<void>;
  writeBatch(events: AnalyticsEventInput[]): Promise<number>;
  listHot(params: AnalyticsQueryParams): Promise<PaginatedResult<AnalyticsEvent>>;
  listCold(params: AnalyticsQueryParams): Promise<PaginatedResult<AnalyticsEvent>>;
  getStatistic(): Promise<AnalyticsStatistic>;
  getDashboardSummary(): Promise<AnalyticsDashboardSummary>;
  listIpSessions(limit: number, offset: number, filter?: AnalyticsFilterObject): Promise<AnalyticsIpSessionPage>;
  describeSelection(objectType: string): Promise<AnalyticsSelectionDescriptor>;
  inspectEvents(filter?: AnalyticsFilterObject): Promise<AnalyticsSelectionStats>;
  importGeoLiteBatch(batch: GeoLiteImportBatch): Promise<number>;
  completeGeoLiteImport(dataset: GeoLiteDataset, importId: string): Promise<number>;
  getGeoLiteDatabaseStatus(): Promise<GeoLiteDatabaseStatus[]>;
  listGeoLiteDatabase(dataset: GeoLiteDataset, limit: number, offset: number): Promise<GeoLiteDatabasePage>;
  clearGeoLiteCountry(): Promise<void>;
  clearGeoLiteAsn(): Promise<void>;
  archiveHotToCold(): Promise<number>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createAnalyticsServiceClient(
  config: CrullerTransportClientConfig,
): AnalyticsServiceClient {
  return createCrullerTransportClient<AnalyticsServiceClient>(metadata, config);
}

export function createAnalyticsServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): AnalyticsServiceClient {
  return createAnalyticsServiceClient(config);
}
