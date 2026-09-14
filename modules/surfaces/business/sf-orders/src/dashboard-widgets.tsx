import { useUnit } from "effector-preact";
import {
	ClipboardList,
	type DashboardWidgetEntry,
	Gauge,
	PackageCheck,
	Printer,
	registerDashboardWidgets,
	StatisticCard,
	useSurfaceTranslation,
} from "front-core";
import type { OrderDailyPoint } from "g-orders";
import type { RequestDailyPoint } from "g-requests";
import { useEffect, useMemo } from "preact/compat";
import { OrderConversionChart } from "./components/OrderConversionChart";
import { SURFACE_ID } from "./config";
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

function formatWeight(grams: number | undefined) {
	const value = grams ?? 0;
	return value >= 1000 ? `${(value / 1000).toFixed(1)} kg` : `${value} g`;
}

/** Every tile wants the same two things: the numbers, and the words for them. */
function useOrdersDashboardLive() {
	const dashboardState = useUnit($dashboardState);
	const { t } = useSurfaceTranslation(SURFACE_ID);
	useEffect(() => {
		ordersViewMounted();
	}, []);
	return { state: dashboardState, text: (key: string) => String(t(key)) };
}

export function RequestsIndicator() {
	const { state, text } = useOrdersDashboardLive();
	return (
		<StatisticCard
			title={text("widgets.requests.title")}
			value={state.requests?.total ?? 0}
			icon={ClipboardList}
			description={text("widgets.requests.description")}
			dashboardPin={{ enabled: false }}
		/>
	);
}

export function OrdersIndicator() {
	const { state, text } = useOrdersDashboardLive();
	const stats = state.orders?.stats;
	return (
		<StatisticCard
			title={text("widgets.orders.title")}
			value={stats?.ordersTotal ?? 0}
			icon={PackageCheck}
			description={text("widgets.orders.description")}
			dashboardPin={{ enabled: false }}
			trend={{
				value: `${stats?.queuedTotal ?? 0}`,
				label: text("widgets.orders.queued"),
				direction: "neutral",
			}}
		/>
	);
}

export function PrintingIndicator() {
	const { state, text } = useOrdersDashboardLive();
	const stats = state.orders?.stats;
	return (
		<StatisticCard
			title={text("widgets.printing.title")}
			value={stats?.printingTotal ?? 0}
			icon={Printer}
			description={text("widgets.printing.description")}
			dashboardPin={{ enabled: false }}
			trend={{
				value: `${stats?.inProgressTotal ?? 0}`,
				label: text("widgets.printing.inProgress"),
				direction: "neutral",
			}}
		/>
	);
}

export function UtilizationIndicator() {
	const { state, text } = useOrdersDashboardLive();
	const stats = state.orders?.stats;
	return (
		<StatisticCard
			title={text("widgets.progress.title")}
			value={formatPercent(stats?.utilizationPercent)}
			icon={Gauge}
			description={text("widgets.progress.description")}
			dashboardPin={{ enabled: false }}
			trend={{
				value: formatWeight(stats?.materialWeightGrams),
				label: text("widgets.progress.material"),
				direction: "neutral",
			}}
		/>
	);
}

export function ConversionIndicator() {
	const { state } = useOrdersDashboardLive();
	const data = useMemo(
		() =>
			buildConversionData(
				state.requests?.daily ?? [],
				state.orders?.daily ?? [],
			),
		[state.orders?.daily, state.requests?.daily],
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
