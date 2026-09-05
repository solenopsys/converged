import { EntityListView } from "front-core";
import { defineSurface, objectRef, setOf } from "front-core/object-runtime";
import { COLUMN_TYPES } from "front-core/table";
import type { PaginationParams } from "g-files";
import filesService from "./service";

const fileColumns = [
	{ id: "name", title: "Name", type: COLUMN_TYPES.TEXT, primary: true },
	{ id: "fileType", title: "Type", type: COLUMN_TYPES.TEXT },
	{ id: "fileSize", title: "Size", type: COLUMN_TYPES.NUMBER },
	{ id: "owner", title: "Owner", type: COLUMN_TYPES.TEXT },
	{ id: "status", title: "Status", type: COLUMN_TYPES.STATUS },
	{ id: "createdAt", title: "Created", type: COLUMN_TYPES.DATE },
];

export default defineSurface({
	id: "sf-files",
	label: "Files",
	purpose: "Uploaded files and everything extracted from them",
	types: [
		{
			id: "files.file",
			label: "File",
			pluralLabel: "Files",
			categories: ["core.entity", "core.selectable"],
			selection: {
				filters: [],
				load: (params) => filesService.list(params),
			},
			infinity: {
				tableId: "files",
				title: "Files",
				columns: fileColumns,
				load: (params) => filesService.list(params as PaginationParams),
				rowRef: (row) => {
					const file = row as { id?: unknown; name?: unknown };
					const id = String(file.id ?? "");
					return objectRef("files.file", id, {
						title: typeof file.name === "string" ? file.name : id,
					});
				},
				filters: [
					{
						id: "name",
						label: "Name",
						type: "search",
						operator: "contains",
					},
					{
						id: "fileType",
						label: "Type",
						type: "search",
						operator: "contains",
					},
					{
						id: "owner",
						label: "Owner",
						type: "search",
						operator: "contains",
					},
					{
						id: "status",
						label: "Status",
						type: "select",
						operator: "eq",
						options: [
							{ value: "uploading", label: "Uploading" },
							{ value: "uploaded", label: "Uploaded" },
							{ value: "failed", label: "Failed" },
						],
					},
					{
						id: "createdAt",
						label: "Created",
						type: "date-range",
						operator: "between",
						valueType: "date",
					},
				],
			},
		},
	],
	views: [
		{
			id: "files.file.table",
			accepts: setOf("files.file"),
			component: EntityListView,
		},
	],
	operations: [],
});
