import { getTableColumns } from "front-core";
import { cronsFields } from "./fields";

export const cronsColumns = getTableColumns(cronsFields);

export const historyColumns = getTableColumns([
	{
		id: "firedAt",
		title: "Fired At",
		type: "date",
		tableVisible: true,
		minWidth: 180,
	},
	{
		id: "cronName",
		title: "Cron",
		type: "text",
		tableVisible: true,
		minWidth: 150,
	},
	{
		id: "provider",
		title: "Provider",
		type: "text",
		tableVisible: true,
		minWidth: 100,
	},
	{
		id: "action",
		title: "Action",
		type: "text",
		tableVisible: true,
		minWidth: 100,
	},
	{
		id: "success",
		title: "Status",
		type: "boolean",
		tableVisible: true,
		width: 80,
	},
	{
		id: "message",
		title: "Message",
		type: "text",
		tableVisible: true,
		minWidth: 200,
	},
]);
