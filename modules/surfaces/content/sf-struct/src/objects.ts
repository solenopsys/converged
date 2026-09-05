import { defineSurface, setOf } from "front-core/object-runtime";
import { StructListView } from "./views/StructListView";

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
		},
	],
	views: [
		{
			id: "struct.node.table",
			accepts: setOf("struct.node"),
			component: StructListView,
		},
	],
	operations: [],
});
