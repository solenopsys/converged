import type { FieldConfig } from "front-core";

export const scriptsColumns: FieldConfig[] = [
	{
		id: "path",
		title: "Path",
		type: "text",
		tableVisible: true,
		formVisible: true,
	},
	{
		id: "hash",
		title: "Hash",
		type: "text",
		tableVisible: true,
		formVisible: true,
	},
];

