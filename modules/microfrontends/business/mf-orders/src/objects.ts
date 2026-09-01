import { defineMicrofrontend, setOf } from "front-core/object-runtime";
import { ordersClient } from "./services";
import { OrdersDashboardView } from "./views/OrdersDashboardView";

export default defineMicrofrontend({
	id: "mf-orders",
	types: [
		{
			id: "orders.order",
			label: "Order",
			pluralLabel: "Orders",
			categories: ["core.business", "core.selectable"],
			selection: {
				filters: [],
				describe: () => ordersClient.describeSelection("orders.order"),
				load: (params) => ordersClient.listOrders(params),
				inspect: (filter) => ordersClient.inspectOrders(filter),
			},
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
			component: OrdersDashboardView,
		},
		{
			id: "orders.statistic.dashboard",
			accepts: setOf("orders.statistic"),
			component: OrdersDashboardView,
		},
	],
	operations: [],
});
