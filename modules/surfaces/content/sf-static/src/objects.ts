import {
	defineSurface,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import staticService from "./service";
import { StaticCacheEntryView } from "./views/StaticCacheEntryView";
import { StaticCacheListView } from "./views/StaticCacheListView";

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
			component: StaticCacheListView,
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
