import { useUnit } from "effector-react";
import {
	type DashboardWidgetEntry,
	registerDashboardWidgets,
	StatisticCard,
} from "front-core";
import type { OrderDailyPoint } from "g-orders";
import type { RequestDailyPoint } from "g-requests";
import { ClipboardList, Gauge, PackageCheck, Printer } from "lucide-react";
import { useEffect, useMemo } from "react";
import { OrderConversionChart } from "./components/OrderConversionChart";
import { $dashboardState, ordersViewMounted } from "./domain-orders";

function buildConversionData(
	requests: RequestDailyPoint[] = [],
	orders: OrderDailyPoint[] = [],
) {
	const requestByDate = new Map(
		requests.map((point) => [point.date, point.requests]),
	);
	const orderByDate = new Map(
		orders.map((point) => [point.date, point.orders]),
	);
	const dates = [
		...new Set([...requestByDate.keys(), ...orderByDate.keys()]),
	].sort();
	return dates.map((date) => {
		const requestCount = requestByDate.get(date) ?? 0;
		const orderCount = orderByDate.get(date) ?? 0;
		return {
			date,
			requests: requestCount,
			orders: orderCount,
			conversion:
				requestCount > 0
					? Math.round((orderCount / requestCount) * 10000) / 100
					: 0,
		};
	});
}

function formatPercent(value: number | undefined) {
	return `${Math.round(value ?? 0)}%`;
}

function formatHours(value: number | undefined) {
	return `${Math.round(value ?? 0)} h`;
}

function useOrdersDashboardLive() {
	const dashboardState = useUnit($dashboardState);
	useEffect(() => {
		ordersViewMounted();
	}, []);
	return dashboardState;
}

function RequestsIndicator() {
	const dashboardState = useOrdersDashboardLive();
	return (
		<StatisticCard
			title="Requests"
			value={dashboardState.requests?.total ?? 0}
			icon={ClipboardList}
			description="Incoming requests, not orders"
			dashboardPin={{ enabled: false }}
			trend={{
				value: "+15.3%",
				label: "request flow",
				direction: "up",
			}}
		/>
	);
}

function OrdersIndicator() {
	const stats = useOrdersDashboardLive().orders?.stats;
	return (
		<StatisticCard
			title="Orders"
			value={stats?.ordersTotal ?? 0}
			icon={PackageCheck}
			description="Accepted production work"
			dashboardPin={{ enabled: false }}
			trend={{
				value: `${stats?.queuedTotal ?? 0}`,
				label: "queued",
				direction: "neutral",
			}}
		/>
	);
}

function PrintingIndicator() {
	const stats = useOrdersDashboardLive().orders?.stats;
	return (
		<StatisticCard
			title="Printing"
			value={stats?.printingTotal ?? 0}
			icon={Printer}
			description={`Estimated time: ${formatHours(stats?.estimatedPrintingHours)}`}
			dashboardPin={{ enabled: false }}
			trend={{
				value: `${stats?.inProgressTotal ?? 0}`,
				label: "in progress",
				direction: "neutral",
			}}
		/>
	);
}

function UtilizationIndicator() {
	const stats = useOrdersDashboardLive().orders?.stats;
	return (
		<StatisticCard
			title="Utilization"
			value={formatPercent(stats?.utilizationPercent)}
			icon={Gauge}
			description={`Available: ${stats?.availablePrinters ?? 0} of ${stats?.printerCapacity ?? 0} printers`}
			dashboardPin={{ enabled: false }}
			trend={{
				value:
					stats?.utilizationPercent && stats.utilizationPercent > 80
						? "high"
						: "normal",
				direction:
					stats?.utilizationPercent && stats.utilizationPercent > 80
						? "up"
						: "neutral",
			}}
		/>
	);
}

function ConversionIndicator() {
	const dashboardState = useOrdersDashboardLive();
	const data = useMemo(
		() =>
			buildConversionData(
				dashboardState.requests?.daily ?? [],
				dashboardState.orders?.daily ?? [],
			),
		[dashboardState.orders?.daily, dashboardState.requests?.daily],
	);
	return <OrderConversionChart dashboardPin={{ enabled: false }} data={data} />;
}

const widgets: Record<string, DashboardWidgetEntry> = {
	"orders.requests-count": () => <RequestsIndicator />,
	"orders.orders-count": () => <OrdersIndicator />,
	"orders.printing-count": () => <PrintingIndicator />,
	"orders.utilization": () => <UtilizationIndicator />,
	"orders.request-to-order-conversion": {
		render: () => <ConversionIndicator />,
		size: "lg",
	},
};

registerDashboardWidgets(widgets);
