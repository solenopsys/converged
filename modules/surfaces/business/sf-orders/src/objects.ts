import {
	Category,
	defineSurface,
	setOf,
} from "front-core/object-runtime";
import {
	ConversionIndicator,
	OrdersIndicator,
	PrintingIndicator,
	RequestsIndicator,
	UtilizationIndicator,
} from "./dashboard-widgets";
import { ordersClient } from "./services";
import { OrdersSummary } from "./summary";
import { OrdersDashboardView } from "./views/OrdersDashboardView";

export default defineSurface({
	id: "sf-orders",
	types: [
		{
			id: "orders.order",
			label: "Order",
			pluralLabel: "Orders",
			categories: [Category.Business, Category.Selectable],
			selection: {
				filters: [],
				describe: () => ordersClient.describeSelection("orders.order"),
				load: (params) => ordersClient.listOrders(params),
				inspect: (filter) => ordersClient.inspectOrders(filter),
			},
		},
		// The dashboard's readout for this service, shown while its section is
		// collapsed. Everything below it is a block inside the opened section.
		{
			id: "orders.statistic.summary",
			label: "Orders",
			categories: [Category.Statistic, Category.Business],
			statistic: { role: "summary", component: OrdersSummary },
		},
		{
			id: "orders.statistic.requests",
			label: "Requests",
			categories: [Category.Statistic, Category.Business],
			statistic: { component: RequestsIndicator },
		},
		{
			id: "orders.statistic.orders",
			label: "Orders",
			categories: [Category.Statistic, Category.Business],
			statistic: { component: OrdersIndicator },
		},
		{
			id: "orders.statistic.printing",
			label: "Printing",
			categories: [Category.Statistic, Category.Business],
			statistic: { component: PrintingIndicator },
		},
		{
			id: "orders.statistic.utilization",
			label: "Printer utilization",
			categories: [Category.Statistic, Category.Business],
			statistic: { component: UtilizationIndicator },
		},
		{
			id: "orders.statistic.conversion",
			label: "Request to order conversion",
			categories: [Category.Statistic, Category.Business, Category.Financial],
			statistic: { component: ConversionIndicator, size: "lg" },
		},
	],
	views: [
		{
			id: "orders.order.table",
			accepts: setOf("orders.order"),
			component: OrdersDashboardView,
		},
	],
	operations: [],
});
