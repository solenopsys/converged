import { defineMicrofrontend, setOf } from "front-core/object-runtime";
import { SessionsListView } from "./views/SessionsListView";
import { ToolsListView } from "./views/ToolsListView";

export default defineMicrofrontend({
	id: "mf-agents",
	types: [
		{
			id: "agents.session",
			label: "Agent session",
			pluralLabel: "Agent sessions",
			categories: ["core.entity", "core.selectable", "core.executable"],
		},
		{
			id: "agents.tool",
			label: "Agent tool",
			pluralLabel: "Agent tools",
			categories: ["core.entity", "core.selectable", "core.executable"],
		},
	],
	views: [
		{
			id: "agents.session.table",
			accepts: setOf("agents.session"),
			component: SessionsListView,
		},
		{
			id: "agents.tool.table",
			accepts: setOf("agents.tool"),
			component: ToolsListView,
		},
	],
	operations: [],
});
