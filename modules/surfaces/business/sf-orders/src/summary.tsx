import { useUnit } from "effector-preact";
import { Sparkline, StatisticSummary, SummaryMetric } from "front-core";
import { useEffect, useMemo } from "preact/compat";
import { $dashboardState, ordersViewMounted } from "./domain-orders";

// What the Orders section shows while it is collapsed: the numbers someone
// scanning the dashboard needs first, and the order trend as one monochrome
// line. The charts themselves stay inside the opened section.

export function OrdersSummary() {
	const dashboardState = useUnit($dashboardState);

	useEffect(() => {
		ordersViewMounted();
	}, []);

	const stats = dashboardState.orders?.stats;
	const daily = useMemo(
		() => (dashboardState.orders?.daily ?? []).map((point) => point.orders),
		[dashboardState.orders?.daily],
	);

	return (
		<StatisticSummary>
			<SummaryMetric label="Orders" value={stats?.ordersTotal ?? 0} />
			<SummaryMetric label="Queued" value={stats?.queuedTotal ?? 0} />
			<SummaryMetric label="Printing" value={stats?.printingTotal ?? 0} />
			<SummaryMetric
				label="Printers"
				value={`${stats?.availablePrinters ?? 0}/${stats?.printerCapacity ?? 0}`}
			/>
			<SummaryMetric
				label="Utilization"
				value={`${Math.round(stats?.utilizationPercent ?? 0)}%`}
			/>
			<Sparkline values={daily} label="Orders per day" className="ml-auto" />
		</StatisticSummary>
	);
}
