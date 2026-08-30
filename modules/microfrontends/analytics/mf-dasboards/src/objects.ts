import { defineMicrofrontend, objectOf } from "front-core/object-runtime";
import { DashboardLayout } from "./components/DashboardLayout";

export default defineMicrofrontend({
	id: "mf-dasboards",
	types: [
		{
			id: "dashboard.dashboard",
			label: "Dashboard",
			pluralLabel: "Dashboards",
			categories: ["core.statistic"],
		},
	],
	views: [
		{
			id: "dashboard.dashboard.view",
			accepts: objectOf("dashboard.dashboard"),
			component: DashboardLayout,
		},
	],
	operations: [],
});
