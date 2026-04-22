export const FIELD_TYPES = {
	TEXT: "text",
	DATE: "date",
	NUMBER: "number",
} as const;

export const classifierNodeFields = [
	{
		id: "id",
		title: "ID",
		type: FIELD_TYPES.TEXT,
		tableVisible: true,
		minWidth: 220,
	},
	{
		id: "parentId",
		title: "Parent",
		type: FIELD_TYPES.TEXT,
		tableVisible: true,
		minWidth: 220,
	},
	{
		id: "name",
		title: "Name",
		type: FIELD_TYPES.TEXT,
		tableVisible: true,
		minWidth: 220,
	},
	{
		id: "slug",
		title: "Slug",
		type: FIELD_TYPES.TEXT,
		tableVisible: true,
		minWidth: 220,
	},
];

export const classifierMappingFields = [
	{
		id: "groupId",
		title: "Group",
		type: FIELD_TYPES.TEXT,
		tableVisible: true,
		minWidth: 180,
	},
	{
		id: "key",
		title: "Key",
		type: FIELD_TYPES.TEXT,
		tableVisible: true,
		minWidth: 260,
	},
	{
		id: "value",
		title: "Value",
		type: FIELD_TYPES.TEXT,
		tableVisible: true,
		minWidth: 260,
	},
	{
		id: "priority",
		title: "Priority",
		type: FIELD_TYPES.NUMBER,
		tableVisible: true,
		width: 120,
	},
	{
		id: "createdAt",
		title: "Created At",
		type: FIELD_TYPES.DATE,
		tableVisible: true,
		width: 150,
	},
	{
		id: "updatedAt",
		title: "Updated At",
		type: FIELD_TYPES.DATE,
		tableVisible: true,
		width: 150,
	},
];
