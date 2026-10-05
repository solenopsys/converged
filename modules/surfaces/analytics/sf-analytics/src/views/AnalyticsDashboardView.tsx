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
					title: "Site analytics",
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
				<p className="text-sm text-muted-foreground">
					Public site pages; console activity is excluded. Today starts at 00:00 UTC.
				</p>
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<Metric label="Sessions today" value={summary.visits_today} />
					<Metric label="Unique browsers today" value={summary.visitors_today} />
					<Metric label="Page views today" value={summary.page_views_today} />
					<Metric label="Active visitors" value={summary.active_visitors} />
				</div>
				<div className="grid min-h-[300px] gap-4 lg:grid-cols-2">
					<DashboardLineChartCard
						data={statistic.humanTimeline}
						title="Likely human traffic over the last 24 hours"
						description="Sessions and page views by hour"
						xField="timestamp"
						xFormatter={(value) =>
							new Date(Number(value)).toLocaleTimeString([], {
								hour: "2-digit",
							})
						}
						series={[
							{
								key: "visits",
								label: "Sessions",
								color: "var(--ui-chart-1)",
								smooth: true,
							},
							{
								key: "events",
								label: "Page views",
								color: "var(--ui-chart-2)",
								yAxisIndex: 1,
								smooth: true,
							},
						]}
						secondaryAxis={{ name: "Page views", primaryName: "Sessions" }}
					/>
					<DashboardLineChartCard
						data={statistic.botTimeline}
						title="Bot traffic over the last 24 hours"
						description="Sessions and page views by hour"
						xField="timestamp"
						xFormatter={(value) =>
							new Date(Number(value)).toLocaleTimeString([], {
								hour: "2-digit",
							})
						}
						series={[
							{
								key: "visits",
								label: "Sessions",
								color: "var(--ui-chart-1)",
								smooth: true,
							},
							{
								key: "events",
								label: "Page views",
								color: "var(--ui-chart-2)",
								yAxisIndex: 1,
								smooth: true,
							},
						]}
						secondaryAxis={{ name: "Page views", primaryName: "Sessions" }}
					/>
				</div>
				<div className="grid gap-4 lg:grid-cols-3">
					<DashboardPieChartCard
						title="Sessions by estimated visitor type today"
						description="Estimated from browser and interaction signals"
						data={[
							{
								key: "human",
								label: "Likely human",
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
						title="Events by type (all time)"
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
						title="Devices today"
						firstColumn="Device"
						rows={statistic.devices.map((row) => ({
							label: deviceLabel(row.device_type),
							visitors: row.visitors,
							human: row.human,
							bot: row.bot,
							unverified: row.unverified,
						}))}
					/>
					<BreakdownTable
						title="Screen sizes today"
						firstColumn="Resolution"
						rows={statistic.resolutions.map((row) => ({
							label: row.resolution,
							visitors: row.visitors,
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
		visitors?: number;
		human: number;
		bot: number;
		unverified: number;
	}>;
}) {
	return (
		<section className="min-w-0">
			<h2 className="mb-2 text-sm font-semibold">{title}</h2>
			<p className="mb-2 text-xs text-muted-foreground">
				One browser can have multiple sessions. Screen sizes are reported in CSS pixels.
			</p>
			<div className="overflow-auto">
				<table className="w-full border-collapse text-sm">
					<thead>
						<tr className="text-left text-muted-foreground">
							<th className="border-b p-2">{firstColumn}</th>
							<th className="border-b p-2">Unique browsers</th>
							<th className="border-b p-2">Likely human sessions</th>
							<th className="border-b p-2">Bot sessions</th>
							<th className="border-b p-2">Unverified sessions</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row.label}>
								<td className="border-b p-2">{row.label}</td>
								<td className="border-b p-2">{row.visitors?.toLocaleString() ?? "—"}</td>
								<td className="border-b p-2">{row.human.toLocaleString()}</td>
								<td className="border-b p-2">{row.bot.toLocaleString()}</td>
								<td className="border-b p-2">
									{row.unverified.toLocaleString()}
								</td>
							</tr>
						))}
						{rows.length === 0 && (
							<tr>
								<td className="p-2 text-muted-foreground" colSpan={5}>
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
