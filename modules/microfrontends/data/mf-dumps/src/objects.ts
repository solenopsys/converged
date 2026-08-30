import {
	defineMicrofrontend,
	objectOf,
	setOf,
} from "front-core/object-runtime";
import { DumpsView } from "./views/DumpsView";
import { StorageDashboardView } from "./views/StorageDashboardView";
import { StoragesView } from "./views/StoragesView";

export default defineMicrofrontend({
	id: "mf-dumps",
	types: [
		{
			id: "dumps.dump",
			label: "Dump",
			pluralLabel: "Dumps",
			categories: ["core.entity", "core.selectable"],
		},
		{
			id: "dumps.storage",
			label: "Storage",
			pluralLabel: "Storages",
			categories: ["core.entity", "core.selectable"],
		},
	],
	views: [
		{
			id: "dumps.dump.table",
			accepts: setOf("dumps.dump"),
			component: DumpsView,
		},
		{
			id: "dumps.storage.table",
			accepts: setOf("dumps.storage"),
			component: StoragesView,
		},
		{
			id: "dumps.storage.dashboard",
			accepts: objectOf("dumps.storage"),
			component: StorageDashboardView,
		},
	],
	operations: [],
});
