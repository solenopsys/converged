import {
	defineMicrofrontend,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import {
	createScriptClicked,
	openScriptClicked,
	saveScriptClicked,
} from "./domain-scripts";
import { ScriptsEditView } from "./views/ScriptsEditView";
import { ScriptsListView } from "./views/ScriptsListView";

export default defineMicrofrontend({
	id: "mf-scripts",
	types: [
		{
			id: "scripts.script",
			label: "Script",
			pluralLabel: "Scripts",
			categories: [
				"core.automation",
				"core.selectable",
				"core.creatable",
				"core.editable",
				"core.executable",
			],
		},
	],
	views: [
		{
			id: "scripts.script.edit",
			accepts: objectOf("scripts.script"),
			component: ScriptsEditView,
			props: (ref) => {
				if (ref.kind === "object") openScriptClicked({ path: ref.id } as any);
				return {};
			},
		},
		{
			id: "scripts.script.table",
			accepts: setOf("scripts.script"),
			component: ScriptsListView,
		},
	],
	operations: [
		{
			id: "scripts.script.create",
			operator: "create",
			target: "scripts.script",
			label: "Create script",
			output: objectOf("scripts.script"),
			parameters: {
				type: "object",
				properties: { path: { type: "string" }, content: { type: "string" } },
				required: ["path"],
			},
			invoke: ({ params }) => {
				createScriptClicked(params as any);
				return objectRef("scripts.script", String(params.path));
			},
		},
		{
			id: "scripts.script.save",
			operator: "save",
			target: "scripts.script",
			label: "Save script",
			inputs: [
				{
					name: "script",
					accepts: objectOf("scripts.script"),
					required: false,
				},
			],
			invoke: () => saveScriptClicked(),
		},
	],
});
