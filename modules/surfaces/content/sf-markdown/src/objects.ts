import {
	defineSurface,
	objectOf,
	objectRef,
	setOf,
} from "front-core/object-runtime";
import { editMdClicked, saveMdClicked } from "./domain-markdown";
import { MdEditView } from "./views/MdEditView";
import { MdListView } from "./views/MdListView";

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
		},
	],
	views: [
		{
			id: "markdown.document.edit",
			accepts: objectOf("markdown.document"),
			component: MdEditView,
			props: (ref) => {
				if (ref.kind === "object") editMdClicked({ path: ref.id } as any);
				return {};
			},
		},
		{
			id: "markdown.document.table",
			accepts: setOf("markdown.document"),
			component: MdListView,
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
				saveMdClicked(params as any);
				return objectRef("markdown.document", String(params.path));
			},
		},
	],
});
