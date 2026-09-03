import {
	defineMicrofrontend,
	objectOf,
	objectRef,
} from "front-core/object-runtime";
import { DashboardLayout } from "./components/DashboardLayout";

const DASHBOARD_REF = () =>
	objectRef("dashboard.dashboard", "statistics", { title: "Dashboard" });

export default defineMicrofrontend({
	id: "mf-dasboards",
	types: [
		{
			id: "dashboard.dashboard",
			label: "Dashboard",
			pluralLabel: "Dashboards",
			description:
				"Every published statistic, grouped by the service that owns it.",
			// Deliberately not `core.statistic`: this type is the page that renders
			// that category, and listing itself would make it its own section.
		},
	],
	views: [
		{
			id: "dashboard.dashboard.view",
			accepts: objectOf("dashboard.dashboard"),
			component: DashboardLayout,
		},
	],
	operations: [
		{
			id: "dashboard.dashboard.open",
			operator: "open",
			target: "dashboard.dashboard",
			label: "Dashboard",
			description: "Open the statistics dashboard.",
			output: objectOf("dashboard.dashboard"),
			presentOutput: true,
			invoke: DASHBOARD_REF,
		},
	],
});
