import type { FieldConfig } from "front-core";

function formatBytes(value: unknown): string {
	const bytes = typeof value === "number" ? value : 0;
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
	if (bytes < 1024 * 1024 * 1024)
		return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
	return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GiB`;
}

function formatDate(value: unknown): string {
	return typeof value === "string" ? new Date(value).toLocaleString() : "";
}

export const fileColumns: FieldConfig[] = [
	{
		id: "name",
		title: "Name",
		type: "text",
		tableVisible: true,
		formVisible: true,
	},
	{
		id: "fileType",
		title: "Type",
		type: "text",
		tableVisible: true,
		formVisible: true,
	},
	{
		id: "fileSize",
		title: "Size",
		type: "text",
		tableVisible: true,
		formVisible: true,
		tableRender: formatBytes,
	},
	{
		id: "owner",
		title: "Owner",
		type: "text",
		tableVisible: true,
		formVisible: true,
	},
	{
		id: "status",
		title: "Status",
		type: "text",
		tableVisible: true,
		formVisible: true,
	},
	{
		id: "createdAt",
		title: "Created",
		type: "text",
		tableVisible: true,
		formVisible: true,
		tableRender: formatDate,
	},
	{
		id: "id",
		title: "ID",
		type: "text",
		tableVisible: false,
		formVisible: true,
	},
];
