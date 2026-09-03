import { COLUMN_TYPES } from "front-core/table";

export const secretsColumns = [
	{
		id: "name",
		title: "Secret Name",
		type: COLUMN_TYPES.TEXT,
		primary: true,
		minWidth: 200,
	},
];
