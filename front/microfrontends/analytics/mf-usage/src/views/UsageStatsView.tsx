import { useUnit } from "effector-react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	HeaderPanel,
} from "front-core";
import { RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { UsagePieChart } from "../components/UsagePieChart";
import { UsageStatsChart } from "../components/UsageStatsChart";
import {
	$dailyStats,
	$functionStats,
	$totalStats,
	refreshUsageStatsClicked,
	usageStatsViewMounted,
} from "../domain-stats";

export const UsageStatsView = () => {
	const dailyStats = useUnit($dailyStats);
	const totalStats = useUnit($totalStats);
	const functionStats = useUnit($functionStats);

	useEffect(() => {
		usageStatsViewMounted({});
	}, []);

	const headerConfig = {
		title: "Usage Statistics",
		actions: [
			{
				id: "refresh",
				label: "Refresh",
				icon: RefreshCw,
				event: refreshUsageStatsClicked,
				variant: "outline" as const,
			},
		],
	};

	return (
		<div className="flex h-full min-h-0 flex-col">
			<HeaderPanel config={headerConfig} />
			<div className="flex-1 overflow-auto p-4 space-y-4">
				<div className="grid gap-4 md:grid-cols-3">
					<Card
						className="md:col-span-1"
						dashboardPin={{ id: "usage.total", title: "Total usage" }}
					>
						<CardHeader>
							<CardTitle>Total usage</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-3xl font-semibold">{totalStats}</div>
							<div className="text-sm text-muted-foreground">All time</div>
						</CardContent>
					</Card>
					<div className="md:col-span-2 min-h-[260px]">
						<UsageStatsChart
							dashboardPin={{
								id: "usage.daily-usage",
								title: "Daily usage",
								pinnedClassName: "min-h-[260px]",
							}}
							data={dailyStats}
							title="Daily usage"
							description="Usage counts by day"
						/>
					</div>
				</div>
				<div className="min-h-[280px]">
					<UsagePieChart
						dashboardPin={{
							id: "usage.by-action-type",
							title: "Usage by action type",
							pinnedClassName: "min-h-[360px]",
						}}
						data={functionStats}
						title="Usage by action type"
					/>
				</div>
			</div>
		</div>
	);
};

export default UsageStatsView;
