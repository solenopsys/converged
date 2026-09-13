import { useUnit } from "effector-preact";
import { StatisticSummary, SummaryMetric } from "front-core";
import { useEffect } from "preact/compat";
import { $overview, reviewsViewMounted } from "./domain-reviews";

// What the Reviews section shows while it is collapsed on the dashboard: how
// the shop is rated, how much of the queue is waiting, and how far the funnel
// is getting.

export function ReviewsSummary() {
	const overview = useUnit($overview);

	useEffect(() => {
		reviewsViewMounted();
	}, []);

	const dashboard = overview.dashboard;
	const funnel = dashboard?.funnel;

	return (
		<StatisticSummary>
			<SummaryMetric label="Reviews" value={dashboard?.total ?? 0} />
			<SummaryMetric label="Rating" value={dashboard?.averageRating ?? 0} />
			<SummaryMetric label="On moderation" value={dashboard?.pending ?? 0} />
			<SummaryMetric label="Unanswered" value={dashboard?.awaitingReply ?? 0} />
			<SummaryMetric label="Asked" value={funnel?.sent ?? 0} />
			<SummaryMetric label="Answered" value={funnel?.answered ?? 0} />
		</StatisticSummary>
	);
}
