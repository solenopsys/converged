import { arc, pie } from "d3";
import { useUnit } from "effector-preact";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CHART_COLORS,
	DashboardLayout,
	Database,
	HardDrive,
	HeaderPanelLayout,
	Percent,
	ScrollArea,
	StatisticCard,
} from "front-core";
import { useEffect, useMemo } from "preact/compat";
import {
	$storageStats,
	storageStatsViewMounted,
} from "../domain-storage-stats";
import { formatSize } from "../functions/fields";

type StorageDashboardViewProps = {
	storageName: string;
	storageSize?: number;
	totalSize?: number;
};

export const StorageDashboardView = ({
	storageName,
	storageSize = 0,
	totalSize = 0,
}: StorageDashboardViewProps) => {
	const stats = useUnit($storageStats);

	useEffect(() => {
		if (!stats.storages?.length) {
			storageStatsViewMounted();
		}
	}, [stats.storages?.length]);

	const effectiveTotal = totalSize || stats.totalSize || 0;
	const selectedSize =
		storageSize ||
		stats.storages.find((item) => item.name === storageName)?.size ||
		0;

	const share = effectiveTotal > 0 ? (selectedSize / effectiveTotal) * 100 : 0;

	const rank = useMemo(() => {
		const sorted = [...(stats.storages ?? [])].sort((a, b) => b.size - a.size);
		const index = sorted.findIndex((item) => item.name === storageName);
		return index >= 0 ? index + 1 : null;
	}, [stats.storages, storageName]);

	const slices = useMemo(() => {
		const data = [
			{ name: storageName, value: selectedSize, color: CHART_COLORS[0] },
			{
				name: "Other storages",
				value: Math.max(0, effectiveTotal - selectedSize),
				color: CHART_COLORS[1],
			},
		];
		return pie<(typeof data)[number]>().value((item) => item.value)(data);
	}, [effectiveTotal, selectedSize, storageName]);
	const pieArc = arc<(typeof slices)[number]>().innerRadius(56).outerRadius(90);

	const headerConfig = {
		title: `Storage dashboard: ${storageName}`,
	};

	return (
		<HeaderPanelLayout config={headerConfig}>
			<ScrollArea className="h-full">
				<DashboardLayout>
					<div className="grid gap-4 md:grid-cols-3">
						<StatisticCard
							title="Storage"
							value={storageName}
							icon={Database}
							description={rank ? `rank #${rank}` : "selected storage"}
							dashboardPin={{
								id: `dumps.storage.${storageName}.name`,
								title: `Storage ${storageName}`,
							}}
						/>
						<StatisticCard
							title="Size"
							value={formatSize(selectedSize)}
							icon={HardDrive}
							description="current storage size"
							dashboardPin={{
								id: `dumps.storage.${storageName}.size`,
								title: `${storageName} size`,
							}}
						/>
						<StatisticCard
							title="Share"
							value={`${share.toFixed(2)}%`}
							icon={Percent}
							description="of total dump volume"
							dashboardPin={{
								id: `dumps.storage.${storageName}.share`,
								title: `${storageName} share`,
							}}
						/>
					</div>

					<Card
						className="flex h-[320px] flex-col gap-4 py-4"
						dashboardPin={{
							id: `dumps.storage.${storageName}.share-chart`,
							title: "Selected storage vs all others",
							pinnedClassName: "min-h-[320px]",
						}}
					>
						<CardHeader className="shrink-0 px-4 pb-2">
							<CardDescription>Selected storage vs all others</CardDescription>
						</CardHeader>
						<CardContent className="flex min-h-0 flex-1 px-4 pb-4 pt-0">
							<div className="h-full min-h-[220px] w-full overflow-hidden">
								<svg
									viewBox="0 0 240 240"
									className="h-full w-full"
									role="img"
									aria-label="Storage size distribution"
								>
									<g transform="translate(120 120)">
										{slices.map((slice) => (
											<path
												key={slice.data.name}
												d={pieArc(slice) ?? ""}
												fill={slice.data.color}
											>
												<title>{`${slice.data.name}: ${formatSize(slice.data.value)}`}</title>
											</path>
										))}
									</g>
								</svg>
							</div>
						</CardContent>
					</Card>
				</DashboardLayout>
			</ScrollArea>
		</HeaderPanelLayout>
	);
};
