import { getTableColumns } from "front-core/table";

const fields = [
	{ id: "ts", title: "Time", type: "date", tableVisible: true, width: 170 },
	{
		id: "event_type",
		title: "Event",
		type: "text",
		tableVisible: true,
		width: 130,
	},
	{
		id: "audience_type",
		title: "Audience",
		type: "text",
		tableVisible: true,
		width: 130,
	},
	{
		id: "content_type",
		title: "Content type",
		type: "text",
		tableVisible: true,
		width: 150,
	},
	{
		id: "content_id",
		title: "Content block",
		type: "text",
		tableVisible: true,
		minWidth: 170,
	},
	{ id: "url", title: "Page", type: "text", tableVisible: true, minWidth: 240 },
	{
		id: "visitor_id",
		title: "Visitor",
		type: "text",
		tableVisible: true,
		minWidth: 170,
	},
	{
		id: "session_id",
		title: "Session",
		type: "text",
		tableVisible: true,
		minWidth: 170,
	},
	{
		id: "trusted_clicks",
		title: "Clicks",
		type: "number",
		tableVisible: true,
		width: 90,
	},
	{
		id: "visible_ms",
		title: "Visible ms",
		type: "number",
		tableVisible: true,
		width: 110,
	},
];

export const analyticsColumns = getTableColumns(fields);
