import { EntityListView } from "front-core";
import {
	defineSurface,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import { COLUMN_TYPES } from "front-core/table";
import type { PaginationParams } from "g-markdown";
import { editMdClicked, saveMdClicked } from "./domain-markdown";
import markdownService from "./service";

type MarkdownMutation = { path: string; content: string };

import { MdEditView } from "./views/MdEditView";

const markdownColumns = [
	{ id: "path", title: "Path", type: COLUMN_TYPES.TEXT, primary: true },
];

export default defineSurface({
	id: "sf-markdown",
	label: "Markdown",
	purpose: "Markdown documents and their editor",
	types: [
		{
			id: "markdown.document",
			label: "Markdown document",
			pluralLabel: "Markdown documents",
			categories: [
				"core.content",
				"core.selectable",
				"core.creatable",
				"core.editable",
			],
			selection: {
				filters: [],
				load: (params) => markdownService.listOfMd(params),
			},
			infinity: {
				tableId: "markdown",
				title: "Markdown Files",
				columns: markdownColumns,
				load: (params) => markdownService.listOfMd(params as PaginationParams),
				rowRef: (row) => {
					const file = row as { path?: unknown };
					const path = String(file.path ?? "");
					return objectRef("markdown.document", path, { title: path });
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
			id: "markdown.document.edit",
			accepts: objectOf("markdown.document"),
			component: MdEditView,
			props: (ref) => {
				if (ref.kind === "object") editMdClicked({ path: ref.id, content: "" });
				return {};
			},
		},
		{
			id: "markdown.document.table",
			accepts: setOf("markdown.document"),
			component: EntityListView,
		},
	],
	operations: [
		{
			id: "markdown.document.save",
			operator: "save",
			target: "markdown.document",
			label: "Save markdown document",
			output: objectOf("markdown.document"),
			parameters: {
				type: "object",
				properties: { path: { type: "string" }, content: { type: "string" } },
				required: ["path", "content"],
			},
			invoke: ({ params }) => {
				saveMdClicked(params as MarkdownMutation);
				return objectRef("markdown.document", String(params.path));
			},
		},
	],
});
