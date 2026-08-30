import { defineMicrofrontend, setOf } from "front-core/object-runtime";
import { FunctionsListView } from "./views/FunctionsListView";

export default defineMicrofrontend({
	id: "mf-functions",
	types: [
		{
			id: "runtime.operation",
			label: "Operation",
			pluralLabel: "Operations",
			categories: ["core.entity", "core.selectable", "core.executable"],
		},
	],
	views: [
		{
			id: "runtime.operation.table",
			accepts: setOf("runtime.operation"),
			component: FunctionsListView,
		},
	],
	operations: [],
});
