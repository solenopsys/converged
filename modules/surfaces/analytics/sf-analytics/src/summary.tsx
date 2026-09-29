import { StatisticSummary, SummaryMetric } from "front-core";
import { useUnit } from "effector-preact";
import { useEffect } from "preact/hooks";
import { $analyticsSummary, dashboardMounted } from "./domain-stats";

export function AnalyticsSummary() {
	const summary = useUnit($analyticsSummary);
	useEffect(() => {
		dashboardMounted();
	}, []);
	return (
		<StatisticSummary>
			<SummaryMetric label="Visits today" value={summary.visits_today} />
			<SummaryMetric label="Visitors today" value={summary.visitors_today} />
			<SummaryMetric label="Page views" value={summary.page_views_today} />
			<SummaryMetric label="Active now" value={summary.active_visitors} />
		</StatisticSummary>
	);
}
