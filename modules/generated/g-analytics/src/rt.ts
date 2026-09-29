// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

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

const metadata: ServiceMetadata = {
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
      "name": "importGeoLiteCountryBatch",
      "parameters": [
        {
          "name": "rows",
          "type": "GeoLiteCountryNetworkInput",
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
      "name": "importGeoLiteAsnBatch",
      "parameters": [
        {
          "name": "rows",
          "type": "GeoLiteAsnNetworkInput",
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
      "definition": "{\n\tts: number;\n\tvisitor_id: string;\n\tsession_id: string;\n\tevent_type: string;\n\tcompany_id: string;\n\tcampaign_id: string;\n\turl: string;\n\treferrer: string;\n\tlanguage: string;\n\ttimezone: string;\n\tuser_agent: string;\n\tscreen: string;\n\tviewport: string;\n\tpixel_ratio: number;\n\ttouch_points: number;\n\thardware_concurrency: number;\n\tdevice_memory: number;\n\twebdriver: boolean;\n\tvisible_ms: number;\n\thidden_ms: number;\n\tpointer_events: number;\n\tpointer_distance: number;\n\tpointer_directions: number;\n\tscroll_events: number;\n\tscroll_max: number;\n\ttrusted_clicks: number;\n\tuntrusted_clicks: number;\n\tkey_events: number;\n\tuser_activation: boolean;\n\tfirst_interaction_ms: number;\n\tip_address: string;\n\tcountry_code: string;\n\tcountry_name: string;\n\tasn: number;\n\tasn_organization: string;\n}"
    },
    {
      "name": "AnalyticsEventInput",
      "kind": "type",
      "definition": "Partial<AnalyticsEvent> & {\n\tvisitor_id: string;\n\tsession_id: string;\n\tevent_type: string;\n\turl: string;\n}"
    },
    {
      "name": "AnalyticsQueryParams",
      "kind": "type",
      "definition": "{\n\toffset: number;\n\tlimit: number;\n\tvisitor_id?: string;\n\tsession_id?: string;\n\tevent_type?: string;\n\turl?: string;\n\tcountry_code?: string;\n\tip_address?: string;\n\tfrom_ts?: number;\n\tto_ts?: number;\n\tfilter?: Record<string, unknown>;\n}"
    },
    {
      "name": "AnalyticsFilterObject",
      "kind": "type",
      "definition": "Record<string, unknown>"
    },
    {
      "name": "AnalyticsStatistic",
      "kind": "type",
      "definition": "{\n\ttotalHot: number;\n\ttotalCold: number;\n\tbyEvent: Record<string, number>;\n\tdashboard: AnalyticsDashboardSummary;\n\ttimeline: AnalyticsTimelineBucket[];\n\tvisitorTypes: AnalyticsVisitorTypeCounts;\n}"
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
      "name": "GeoLiteCountryNetworkInput",
      "kind": "type",
      "definition": "{\n\tnetwork: string;\n\tcountry_code: string;\n\tcountry_name?: string;\n}"
    },
    {
      "name": "GeoLiteAsnNetworkInput",
      "kind": "type",
      "definition": "{\n\tnetwork: string;\n\tasn: number;\n\torganization: string;\n}"
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

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface AnalyticsServiceRtClient {
  write(event: AnalyticsEventInput): void;
  writeBatch(events: AnalyticsEventInput[]): number;
  listHot(params: AnalyticsQueryParams): PaginatedResult<AnalyticsEvent>;
  listCold(params: AnalyticsQueryParams): PaginatedResult<AnalyticsEvent>;
  getStatistic(): AnalyticsStatistic;
  getDashboardSummary(): AnalyticsDashboardSummary;
  describeSelection(objectType: string): AnalyticsSelectionDescriptor;
  inspectEvents(filter?: AnalyticsFilterObject): AnalyticsSelectionStats;
  importGeoLiteCountryBatch(rows: GeoLiteCountryNetworkInput[]): number;
  importGeoLiteAsnBatch(rows: GeoLiteAsnNetworkInput[]): number;
  clearGeoLiteCountry(): void;
  clearGeoLiteAsn(): void;
  archiveHotToCold(): number;
}

export function createAnalyticsServiceRtClient(): AnalyticsServiceRtClient {
  return createRtClient<AnalyticsServiceRtClient>(metadata);
}
