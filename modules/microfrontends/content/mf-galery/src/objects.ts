import { defineMicrofrontend, setOf } from "front-core/object-runtime";
import { GaleryListView } from "./views/GaleryListView";

export default defineMicrofrontend({
	id: "mf-galery",
	types: [
		{
			id: "gallery.asset",
			label: "Gallery asset",
			pluralLabel: "Gallery",
			categories: ["core.content", "core.selectable"],
		},
	],
	views: [
		{
			id: "gallery.asset.grid",
			accepts: setOf("gallery.asset"),
			component: GaleryListView,
		},
	],
	operations: [],
});
