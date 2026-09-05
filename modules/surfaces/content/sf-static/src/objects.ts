import { EntityListView } from "front-core";
import {
	defineSurface,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import { COLUMN_TYPES } from "front-core/table";
import type { ListMetaParams } from "g-static";
import staticService from "./service";
import { StaticCacheEntryView } from "./views/StaticCacheEntryView";

const staticCacheColumns = [
	{ id: "id", title: "Page", type: COLUMN_TYPES.TEXT, primary: true },
	{ id: "status", title: "Status", type: COLUMN_TYPES.STATUS },
	{ id: "contentType", title: "Type", type: COLUMN_TYPES.TEXT },
	{ id: "size", title: "Size", type: COLUMN_TYPES.NUMBER },
	{ id: "updatedAt", title: "Updated", type: COLUMN_TYPES.DATE },
];

type CacheEntryMutation = {
	id?: string;
	contentType?: "html" | "svg";
	status?: "todo" | "loaded" | "outdated";
};

export default defineSurface({
	id: "sf-static",
	label: "SSR cache",
	purpose: "Server-rendered page cache: entries, freshness and invalidation",
	types: [
		{
			id: "static.cache-entry",
			label: "SSR cache entry",
			pluralLabel: "SSR cache entries",
			categories: [
				"core.content",
				"core.selectable",
				"core.creatable",
				"core.editable",
			],
			selection: {
				filters: [],
				describe: () => staticService.describeSelection("static.cache-entry"),
				load: (params) => staticService.listMeta(params),
				inspect: (filter) => staticService.inspectCacheEntries(filter),
			},
			infinity: {
				tableId: "static-cache-entries",
				title: "SSR cache",
				columns: staticCacheColumns,
				load: (params) => staticService.listMeta(params as ListMetaParams),
				rowRef: (row) => {
					const entry = row as { id?: unknown };
					const id = String(entry.id ?? "");
					return objectRef("static.cache-entry", id, { title: id });
				},
				filters: [
					{
						id: "id",
						label: "Page",
						type: "search",
						operator: "contains",
					},
					{
						id: "status",
						label: "Status",
						type: "select",
						operator: "eq",
						options: [
							{ value: "todo", label: "Todo" },
							{ value: "loaded", label: "Loaded" },
							{ value: "outdated", label: "Outdated" },
						],
					},
					{
						id: "contentType",
						label: "Type",
						type: "select",
						operator: "eq",
						options: [
							{ value: "html", label: "HTML" },
							{ value: "svg", label: "SVG" },
						],
					},
					{
						id: "size",
						label: "Size",
						type: "search",
						operator: "gte",
						valueType: "number",
					},
					{
						id: "updatedAt",
						label: "Updated",
						type: "search",
						operator: "gte",
						valueType: "number",
					},
				],
			},
		},
	],
	views: [
		{
			id: "static.cache-entry.detail",
			accepts: objectOf("static.cache-entry"),
			component: StaticCacheEntryView,
			props: (ref) => ({ entryId: ref.kind === "object" ? ref.id : undefined }),
		},
		{
			id: "static.cache-entry.table",
			accepts: setOf("static.cache-entry"),
			component: EntityListView,
		},
	],
	operations: [
		{
			id: "static.cache-entry.create",
			operator: "create",
			target: "static.cache-entry",
			label: "Create SSR cache entry",
			output: objectOf("static.cache-entry"),
			parameters: {
				type: "object",
				properties: {
					id: { type: "string" },
					contentType: { type: "string", enum: ["html", "svg"] },
					status: { type: "string", enum: ["todo", "loaded", "outdated"] },
				},
				required: ["id", "contentType"],
			},
			invoke: async ({ params }) => {
				const input = params as CacheEntryMutation;
				if (!input.id || !input.contentType)
					throw new Error("id and contentType are required");
				const entry = await staticService.setMeta({
					id: input.id,
					contentType: input.contentType,
					status: input.status,
				});
				return objectRef("static.cache-entry", entry.id, { title: entry.id });
			},
		},
		{
			id: "static.cache-entry.set-status",
			operator: "save",
			target: "static.cache-entry",
			label: "Set SSR cache entry status",
			inputs: [{ name: "entry", accepts: objectOf("static.cache-entry") }],
			parameters: {
				type: "object",
				properties: {
					status: { type: "string", enum: ["todo", "loaded", "outdated"] },
				},
				required: ["status"],
			},
			invoke: async ({ references, params }) => {
				const entry = references.find(
					(reference) =>
						reference.kind === "object" &&
						reference.type === "static.cache-entry",
				);
				if (entry?.kind !== "object")
					throw new Error("Cache entry reference is required");
				return staticService.setStatus(
					entry.id,
					(params as CacheEntryMutation).status ?? "todo",
				);
			},
		},
		{
			id: "static.cache-entry.delete",
			operator: "execute",
			target: "static.cache-entry",
			label: "Delete SSR cache entry",
			inputs: [{ name: "entry", accepts: objectOf("static.cache-entry") }],
			invoke: async ({ references }) => {
				const entry = references.find(
					(reference) =>
						reference.kind === "object" &&
						reference.type === "static.cache-entry",
				);
				if (entry?.kind !== "object")
					throw new Error("Cache entry reference is required");
				await staticService.deleteEntry(entry.id);
			},
		},
	],
});
