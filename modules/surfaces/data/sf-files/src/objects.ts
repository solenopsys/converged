import { defineSurface, setOf } from "front-core/object-runtime";
import { FilesListView } from "./views/FilesListView";

export default defineSurface({
	id: "sf-files",
	types: [
		{
			id: "files.file",
			label: "File",
			pluralLabel: "Files",
			categories: ["core.entity", "core.selectable"],
		},
	],
	views: [
		{
			id: "files.file.table",
			accepts: setOf("files.file"),
			component: FilesListView,
		},
	],
	operations: [],
});
