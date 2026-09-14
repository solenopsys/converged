import { useUnit } from "effector-preact";
import {
	Sparkline,
	StatisticSummary,
	SummaryMetric,
	useSurfaceTranslation,
} from "front-core";
import { useEffect, useMemo } from "preact/compat";
import { SURFACE_ID } from "./config";
import { $dashboardState, ordersViewMounted } from "./domain-orders";

// What the Orders section shows while it is collapsed: the numbers someone
// scanning the dashboard needs first, and the order trend as one monochrome
// line. The charts themselves stay inside the opened section.

function formatWeight(grams: number | undefined) {
	const value = grams ?? 0;
	return value >= 1000 ? `${(value / 1000).toFixed(1)} kg` : `${value} g`;
}

export function OrdersSummary() {
	const dashboardState = useUnit($dashboardState);
	const { t } = useSurfaceTranslation(SURFACE_ID);

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
			<SummaryMetric
				label={String(t("summary.orders"))}
				value={stats?.ordersTotal ?? 0}
			/>
			<SummaryMetric
				label={String(t("summary.queued"))}
				value={stats?.queuedTotal ?? 0}
			/>
			<SummaryMetric
				label={String(t("summary.printing"))}
				value={stats?.printingTotal ?? 0}
			/>
			{/* Was "8/8 printers", a constant dressed as a measurement. How many
			    machines there are is rp-equipment's answer, not this service's;
			    material booked is one this one actually computes. */}
			<SummaryMetric
				label={String(t("summary.material"))}
				value={formatWeight(stats?.materialWeightGrams)}
			/>
			<SummaryMetric
				label={String(t("summary.inProgress"))}
				value={`${Math.round(stats?.utilizationPercent ?? 0)}%`}
			/>
			<Sparkline
				values={daily}
				label={String(t("summary.perDay"))}
				className="ml-auto"
			/>
		</StatisticSummary>
	);
}
