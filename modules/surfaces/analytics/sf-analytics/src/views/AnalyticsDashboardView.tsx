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
								color: "var(--ui-chart-1)",
							},
							{
								key: "bot",
								label: "Bot",
								value: statistic.visitorTypes.bot,
								color: "var(--ui-chart-2)",
							},
							{
								key: "unverified",
								label: "Unverified",
								value: statistic.visitorTypes.unverified,
								color: "var(--hw-ink-muted)",
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
				<div className="grid gap-4 xl:grid-cols-2">
					<BreakdownTable
						title="Sessions by device today"
						firstColumn="Device"
						rows={statistic.devices.map((row) => ({
							label: deviceLabel(row.device_type),
							human: row.human,
							bot: row.bot,
							unverified: row.unverified,
						}))}
					/>
					<BreakdownTable
						title="Sessions by screen resolution today"
						firstColumn="Resolution"
						rows={statistic.resolutions.map((row) => ({
							label: row.resolution,
							human: row.human,
							bot: row.bot,
							unverified: row.unverified,
						}))}
					/>
				</div>
			</div>
		</div>
	);
}

function deviceLabel(device: string) {
	return (
		(
			{
				mobile: "Mobile",
				tablet: "Tablet",
				desktop: "Desktop",
				unknown: "Unknown",
			} as Record<string, string>
		)[device] ?? device
	);
}

function BreakdownTable({
	title,
	firstColumn,
	rows,
}: {
	title: string;
	firstColumn: string;
	rows: Array<{
		label: string;
		human: number;
		bot: number;
		unverified: number;
	}>;
}) {
	return (
		<section className="min-w-0">
			<h2 className="mb-2 text-sm font-semibold">{title}</h2>
			<div className="overflow-auto">
				<table className="w-full border-collapse text-sm">
					<thead>
						<tr className="text-left text-muted-foreground">
							<th className="border-b p-2">{firstColumn}</th>
							<th className="border-b p-2">Human</th>
							<th className="border-b p-2">Bot</th>
							<th className="border-b p-2">Unverified</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row.label}>
								<td className="border-b p-2">{row.label}</td>
								<td className="border-b p-2">{row.human.toLocaleString()}</td>
								<td className="border-b p-2">{row.bot.toLocaleString()}</td>
								<td className="border-b p-2">
									{row.unverified.toLocaleString()}
								</td>
							</tr>
						))}
						{rows.length === 0 && (
							<tr>
								<td className="p-2 text-muted-foreground" colSpan={4}>
									No session data yet
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</section>
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
