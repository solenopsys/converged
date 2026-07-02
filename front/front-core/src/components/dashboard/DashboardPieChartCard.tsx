import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import {
	ERROR_COLOR,
	isErrorLike as defaultIsErrorLike,
	PIE_COLORS,
} from "../../lib/dashboard-chart";
import { cn } from "../../lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	type DashboardPinMeta,
} from "../ui/card";

export interface DashboardPieChartDatum {
	key: string;
	label: string;
	value: number;
}

export interface DashboardPieChartCardProps {
	title?: string;
	description?: string;
	data: DashboardPieChartDatum[];
	emptyLabel?: string;
	dashboardPin?: DashboardPinMeta | false;
	colors?: string[];
	errorColor?: string;
	isErrorLike?: (value: string) => boolean;
	height?: number;
	radius?: [string, string];
	maxSlices?: number;
	otherLabel?: string;
	legend?: boolean;
	className?: string;
}

/**
 * Standard pie-chart dashboard widget: sorts/colors data, groups a tail into
 * "Other" when maxSlices is set, highlights error-like slices, renders a
 * legend chip row. Domains differ only via data + config, not markup.
 */
export function DashboardPieChartCard({
	title,
	description,
	data,
	emptyLabel = "No data",
	dashboardPin,
	colors = PIE_COLORS,
	errorColor = ERROR_COLOR,
	isErrorLike = defaultIsErrorLike,
	height = 360,
	radius = ["56px", "90px"],
	maxSlices,
	otherLabel = "Other",
	legend = true,
	className,
}: DashboardPieChartCardProps) {
	const chartData = useMemo(() => {
		const sorted = data
			.filter((item) => item.value > 0)
			.sort((a, b) => b.value - a.value);

		const visible = maxSlices ? sorted.slice(0, maxSlices) : sorted;
		const rest = maxSlices ? sorted.slice(maxSlices) : [];
		const otherValue = rest.reduce((sum, item) => sum + item.value, 0);
		const combined =
			otherValue > 0
				? [
						...visible,
						{ key: "__other__", label: otherLabel, value: otherValue },
					]
				: visible;

		return combined.map((item, index) => ({
			...item,
			color: isErrorLike(`${item.key} ${item.label}`)
				? errorColor
				: colors[index % colors.length],
		}));
	}, [data, maxSlices, otherLabel, isErrorLike, errorColor, colors]);

	const option = useMemo(
		() => ({
			tooltip: {
				trigger: "item",
				formatter: (params: { color: string; name: string; value: number }) =>
					`<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${params.color};margin-right:4px"></span>${params.name}: <b>${params.value.toLocaleString()}</b>`,
			},
			series: [
				{
					type: "pie",
					radius,
					label: { show: false },
					emphasis: { label: { show: false } },
					itemStyle: { borderWidth: 2, borderColor: "transparent" },
					data: chartData.map((item) => ({
						name: item.label,
						value: item.value,
						itemStyle: { color: item.color },
					})),
				},
			],
		}),
		[chartData, radius],
	);

	return (
		<Card
			className={cn("flex flex-col gap-4 py-4", className)}
			style={{ height }}
			dashboardPin={dashboardPin}
		>
			{(title || description) && (
				<CardHeader className="shrink-0 px-4 pb-2">
					{title && <CardDescription>{title}</CardDescription>}
					{description && (
						<div className="text-xs text-muted-foreground">{description}</div>
					)}
				</CardHeader>
			)}
			<CardContent className="flex min-h-0 flex-1 px-4 pb-4 pt-0">
				{chartData.length === 0 ? (
					<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
						{emptyLabel}
					</div>
				) : (
					<div className="h-full min-h-[220px] w-full overflow-hidden">
						<ReactECharts
							option={option}
							style={{ height: "100%", width: "100%" }}
						/>
					</div>
				)}
			</CardContent>
			{legend && chartData.length > 0 && (
				<div className="flex flex-wrap gap-x-4 gap-y-2 px-4 pb-4 text-xs">
					{chartData.map((item) => (
						<div
							key={item.key}
							className="flex items-center gap-1.5 text-muted-foreground"
						>
							<span
								className="h-2 w-2 shrink-0 rounded-[2px]"
								style={{ backgroundColor: item.color }}
							/>
							<span>{item.label}</span>
							<span className="font-mono text-foreground">
								{item.value.toLocaleString()}
							</span>
						</div>
					))}
				</div>
			)}
		</Card>
	);
}
