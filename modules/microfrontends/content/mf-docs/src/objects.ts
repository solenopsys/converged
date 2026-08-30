import {
	defineMicrofrontend,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import DocsView from "./views/DocsView";

export default defineMicrofrontend({
	id: "mf-docs",
	types: [
		{
			id: "docs.document",
			label: "Documentation page",
			pluralLabel: "Documentation",
			categories: ["core.content", "core.selectable"],
		},
	],
	views: [
		{
			id: "docs.document.page",
			accepts: objectOf("docs.document"),
			component: DocsView,
			props: (ref) => ({
				indexPath: ref.kind === "object" ? ref.id : undefined,
			}),
		},
		{
			id: "docs.document.index",
			accepts: setOf("docs.document"),
			component: DocsView,
		},
	],
	operations: [
		{
			id: "docs.document.open-home",
			operator: "open",
			target: "docs.document",
			label: "Open documentation",
			access: "public",
			output: objectOf("docs.document"),
			presentOutput: true,
			invoke: () => objectRef("docs.document", "home"),
		},
	],
});
