import { defineMicrofrontend, setOf } from "front-core/object-runtime";
import { StaticCacheView } from "./views/StaticCacheView";

export default defineMicrofrontend({
	id: "mf-static",
	types: [
		{
			id: "static.cache-entry",
			label: "Cache entry",
			pluralLabel: "Static cache",
			categories: ["core.content", "core.selectable"],
		},
	],
	views: [
		{
			id: "static.cache-entry.table",
			accepts: setOf("static.cache-entry"),
			component: StaticCacheView,
		},
	],
	operations: [],
});
