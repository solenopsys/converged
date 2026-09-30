import { useUnit } from "effector-preact";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	DashboardLineChartCard,
	DashboardPieChartCard,
	type HeaderAction,
	HeaderPanel,
	RefreshCw,
} from "front-core";
import { useEffect } from "preact/hooks";
import {
	$analyticsStatistic,
	$analyticsSummary,
	dashboardMounted,
	refreshAnalyticsClicked,
} from "../domain-stats";

export function AnalyticsDashboardView() {
	const summary = useUnit($analyticsSummary);
	const statistic = useUnit($analyticsStatistic);
	useEffect(() => {
		dashboardMounted();
	}, []);
	return (
		<div className="flex h-full min-h-0 flex-col">
			<HeaderPanel
				config={{
					title: "Analytics",
					actions: [
						{
							id: "refresh",
							label: "Refresh",
							icon: RefreshCw as HeaderAction["icon"],
							event: refreshAnalyticsClicked,
							variant: "outline" as const,
						},
					],
				}}
			/>
			<div className="flex-1 space-y-4 overflow-auto p-4">
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<Metric label="Visits today" value={summary.visits_today} />
					<Metric label="Visitors today" value={summary.visitors_today} />
					<Metric label="Page views today" value={summary.page_views_today} />
					<Metric label="Active visitors" value={summary.active_visitors} />
				</div>
				<div className="grid min-h-[300px] gap-4">
					<DashboardLineChartCard
						data={statistic.timeline}
						title="Traffic over the last 24 hours"
						description="Visits and collected events by hour"
						xField="timestamp"
						xFormatter={(value) =>
							new Date(Number(value)).toLocaleTimeString([], {
								hour: "2-digit",
							})
						}
						series={[
							{
								key: "visits",
								label: "Visits",
								color: "var(--ui-chart-1)",
								smooth: true,
							},
							{
								key: "events",
								label: "Events",
								color: "var(--ui-chart-2)",
								yAxisIndex: 1,
								smooth: true,
							},
						]}
						secondaryAxis={{ name: "Events", primaryName: "Visits" }}
					/>
				</div>
				<div className="grid gap-4 lg:grid-cols-3">
					<DashboardPieChartCard
						title="Sessions by visitor type today"
						description="Estimated from browser and interaction signals"
						data={[
							{
								key: "human",
								label: "Human",
								value: statistic.visitorTypes.human,
							},
							{ key: "bot", label: "Bot", value: statistic.visitorTypes.bot },
							{
								key: "unverified",
								label: "Unverified",
								value: statistic.visitorTypes.unverified,
							},
						]}
					/>
					<DashboardPieChartCard
						title="Events by type"
						description={`${summary.events_total.toLocaleString()} events stored`}
						maxSlices={7}
						data={Object.entries(statistic.byEvent).map(([key, value]) => ({
							key,
							label: key,
							value,
						}))}
					/>
					<DashboardPieChartCard
						title="GeoLite database records"
						data={statistic.geoLiteDatabases.map((database) => ({
							key: database.dataset,
							label: database.dataset.toUpperCase(),
							value: database.records,
						}))}
					/>
				</div>
			</div>
		</div>
	);
}

function Metric({ label, value }: { label: string; value: number }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{label}</CardTitle>
			</CardHeader>
			<CardContent>
				<strong className="text-2xl">{value.toLocaleString()}</strong>
			</CardContent>
		</Card>
	);
}
