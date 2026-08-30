import { defineMicrofrontend, setOf } from "front-core/object-runtime";
import Panel from "./Panel";

export default defineMicrofrontend({
	id: "mf-orders",
	types: [
		{
			id: "orders.order",
			label: "Order",
			pluralLabel: "Orders",
			categories: ["core.business", "core.selectable"],
		},
		{
			id: "orders.statistic",
			label: "Order statistic",
			pluralLabel: "Order statistics",
			categories: ["core.statistic", "core.business", "core.financial"],
		},
	],
	views: [
		{
			id: "orders.order.table",
			accepts: setOf("orders.order"),
			component: Panel,
		},
		{
			id: "orders.statistic.dashboard",
			accepts: setOf("orders.statistic"),
			component: Panel,
		},
	],
	operations: [],
});
