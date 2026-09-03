import { createDomain } from "effector";
import { useUnit } from "effector-preact";
import {
	Button,
	ClipboardList,
	cn,
	createInfiniteTableStore,
	Gauge,
	HeaderPanelLayout,
	InfiniteScrollDataTable,
	PackageCheck,
	Printer,
	RefreshCw,
	Send,
	StatisticCard,
} from "front-core";
import type { SetRef } from "front-core/object-runtime";
import type {
	OrderDailyPoint,
	OrderListParams,
	OrderStatusGroup,
} from "g-orders";
import type { RequestDailyPoint } from "g-requests";
import { useEffect, useMemo, useState } from "preact/compat";
import { OrderConversionChart } from "../components/OrderConversionChart";
import { ordersColumns } from "../config";
import { $dashboardState, loadDashboardFx } from "../domain-orders";
import { ordersClient } from "../services";

const STATUS_TABS: Array<{ group: OrderStatusGroup; label: string }> = [
	{ group: "all", label: "Order Statuses" },
	{ group: "queued", label: "Queued" },
	{ group: "in_progress", label: "In Progress" },
	{ group: "completed", label: "Completed" },
	{ group: "blocked", label: "Blocked" },
];

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

export const OrdersDashboardView = ({ reference }: { reference?: SetRef }) => {
	const store = useMemo(() => {
		const domain = createDomain(`orders-${crypto.randomUUID()}`);
		return createInfiniteTableStore(domain, (params) =>
			ordersClient.listOrders(params as OrderListParams),
		);
	}, []);
	const tableState = useUnit(store.$state);
	const dashboardState = useUnit($dashboardState);
	const [activeGroup, setActiveGroup] = useState<OrderStatusGroup>("all");
	const filter =
		reference?.kind === "set" && reference.selection.kind === "query"
			? reference.selection.filter
			: undefined;

	useEffect(() => {
		loadDashboardFx();
	}, []);

	useEffect(() => {
		store.setFilters({
			...(filter ? { filter } : {}),
			...(activeGroup === "all" ? {} : { statusGroup: activeGroup }),
		});
	}, [activeGroup, filter, store]);

	const headerConfig = {
		title: "Orders",
		actions: [
			{
				id: "refresh",
				label: "Refresh",
				icon: RefreshCw,
				event: store.refresh,
				variant: "outline" as const,
			},
		],
	};

	const stats = dashboardState.orders?.stats;
	const statusCounts = dashboardState.orders?.statusCounts ?? [];
	const statusCountByGroup = new Map(
		statusCounts.map((entry) => [entry.group, entry.count]),
	);
	const chartData = useMemo(
		() =>
			buildConversionData(
				dashboardState.requests?.daily ?? [],
				dashboardState.orders?.daily ?? [],
			),
		[dashboardState.orders?.daily, dashboardState.requests?.daily],
	);

	return (
		<HeaderPanelLayout config={headerConfig} contentClassName="p-4">
			<div className="flex h-full min-h-0 flex-col gap-4">
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
					<StatisticCard
						title="Requests"
						value={dashboardState.requests?.total ?? 0}
						icon={ClipboardList}
						description="Incoming requests, not orders"
						dashboardPin={{
							id: "orders.requests-count",
							title: "Orders / Requests",
						}}
						trend={{
							value: "+15.3%",
							label: "request flow",
							direction: "up",
						}}
					/>
					<StatisticCard
						title="Orders"
						value={stats?.ordersTotal ?? 0}
						icon={PackageCheck}
						description="Accepted production work"
						dashboardPin={{ id: "orders.orders-count", title: "Orders" }}
						trend={{
							value: `${stats?.queuedTotal ?? 0}`,
							label: "queued",
							direction: "neutral",
						}}
					/>
					<StatisticCard
						title="Printing"
						value={stats?.printingTotal ?? 0}
						icon={Printer}
						description={`Estimated time: ${formatHours(stats?.estimatedPrintingHours)}`}
						dashboardPin={{ id: "orders.printing-count", title: "Printing" }}
						trend={{
							value: `${stats?.inProgressTotal ?? 0}`,
							label: "in progress",
							direction: "neutral",
						}}
					/>
					<StatisticCard
						title="Utilization"
						value={formatPercent(stats?.utilizationPercent)}
						icon={Gauge}
						description={`Available: ${stats?.availablePrinters ?? 0} of ${stats?.printerCapacity ?? 0} printers`}
						dashboardPin={{ id: "orders.utilization", title: "Utilization" }}
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
				</div>

				<div className="shrink-0">
					<OrderConversionChart
						dashboardPin={{
							id: "orders.request-to-order-conversion",
							title: "Request to Order Conversion",
							pinnedClassName: "min-h-[320px]",
						}}
						data={chartData}
					/>
				</div>

				<div className="flex min-h-0 flex-1 flex-col gap-2">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/20 p-1">
							{STATUS_TABS.map((tab) => {
								const count =
									tab.group === "all"
										? (stats?.ordersTotal ?? tableState.totalCount ?? 0)
										: (statusCountByGroup.get(tab.group) ?? 0);
								const active = activeGroup === tab.group;
								return (
									<Button
										key={tab.group}
										type="button"
										variant={active ? "secondary" : "ghost"}
										size="sm"
										className={cn("h-8 gap-2", active && "shadow-sm")}
										onClick={() => setActiveGroup(tab.group)}
									>
										{tab.label}
										<span className="text-xs text-muted-foreground">
											{count}
										</span>
									</Button>
								);
							})}
						</div>
						<Button type="button" size="sm" variant="outline" className="gap-2">
							<Send className="h-4 w-4" />
							Create order
						</Button>
					</div>

					<div className="min-h-0 flex-1 overflow-hidden rounded-md border">
						<InfiniteScrollDataTable
							tableId="business-orders"
							data={tableState.items}
							totalCount={tableState.totalCount}
							hasMore={tableState.hasMore}
							loading={tableState.loading}
							loadingMore={tableState.loadingMore}
							columns={ordersColumns}
							onLoadMore={store.loadMore}
							viewMode="table"
							emptyMessage="No production orders yet"
						/>
					</div>
				</div>
			</div>
		</HeaderPanelLayout>
	);
};
