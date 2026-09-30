export type AnalyticsContentType = "landing_block" | "documentation_section";

export type AnalyticsContentEvent = {
	event_type: "content_view" | "content_click";
	content_id: string;
	content_type: AnalyticsContentType;
	visible_ms?: number;
};

const ANALYTICS_EVENT = "front-core:analytics-event";

export function emitAnalyticsContentEvent(detail: AnalyticsContentEvent): void {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new CustomEvent(ANALYTICS_EVENT, { detail }));
}
