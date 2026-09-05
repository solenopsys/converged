import { EntityListView } from "front-core";
import { defineSurface, objectRef, setOf } from "front-core/object-runtime";
import { COLUMN_TYPES } from "front-core/table";
import type { PaginationParams } from "g-struct";
import structService from "./service";

const structColumns = [
	{ id: "path", title: "Path", type: COLUMN_TYPES.TEXT, primary: true },
];

export default defineSurface({
	id: "sf-struct",
	label: "Structure",
	purpose: "Structured content nodes shown on public pages",
	types: [
		{
			id: "struct.node",
			label: "Structure node",
			pluralLabel: "Structure",
			categories: ["core.content", "core.selectable"],
			selection: {
				filters: [],
				load: (params) => structService.listOfStruct(params),
			},
			infinity: {
				tableId: "struct",
				title: "Struct Files",
				columns: structColumns,
				load: (params) =>
					structService.listOfStruct(params as PaginationParams),
				rowRef: (row) => {
					const file = row as { path?: unknown };
					const path = String(file.path ?? "");
					return objectRef("struct.node", path, { title: path });
				},
				filters: [
					{
						id: "path",
						label: "Path",
						type: "search",
						operator: "contains",
					},
				],
			},
		},
	],
	views: [
		{
			id: "struct.node.table",
			accepts: setOf("struct.node"),
			component: EntityListView,
		},
	],
	operations: [],
});
