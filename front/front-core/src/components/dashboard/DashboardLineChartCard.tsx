import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import { formatChartDate } from "../../lib/dashboard-chart";
import { cn } from "../../lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	type DashboardPinMeta,
} from "../ui/card";

export interface DashboardLineSeriesConfig {
	key: string;
	label: string;
	color: string;
	type?: "line" | "bar";
	yAxisIndex?: 0 | 1;
	area?: boolean;
	areaOpacity?: number;
	smooth?: boolean;
}

export interface DashboardSecondaryAxisConfig {
	name?: string;
	primaryName?: string;
	min?: number;
	max?: number;
	formatter?: (value: number) => string;
}

export interface DashboardLineChartCardProps {
	data: readonly unknown[];
	series: DashboardLineSeriesConfig[];
	title?: string;
	description?: string;
	xField?: string;
	xFormatter?: (value: string) => string;
	secondaryAxis?: DashboardSecondaryAxisConfig;
	dashboardPin?: DashboardPinMeta | false;
	height?: number;
	legend?: boolean;
	className?: string;
}

/**
 * Standard time-series dashboard widget: single or dual y-axis, mixed
 * line/bar series. Domains differ only via `data` + `series` config.
 */
export function DashboardLineChartCard({
	data,
	series,
	title,
	description,
	xField = "date",
	xFormatter,
	secondaryAxis,
	dashboardPin,
	height,
	legend = true,
	className,
}: DashboardLineChartCardProps) {
	const option = useMemo(() => {
		const rows = data as Record<string, unknown>[];
		const xValues = rows.map((d) => String(d[xField] ?? ""));

		const yAxis = secondaryAxis
			? [
					{
						type: "value",
						name: secondaryAxis.primaryName,
						axisLine: { show: false },
						axisTick: { show: false },
						splitLine: { lineStyle: { color: "rgba(128,128,128,0.15)" } },
					},
					{
						type: "value",
						name: secondaryAxis.name,
						min: secondaryAxis.min,
						max: secondaryAxis.max,
						splitLine: { show: false },
						axisLabel: secondaryAxis.formatter
							? { formatter: secondaryAxis.formatter }
							: undefined,
					},
				]
			: {
					type: "value",
					axisLine: { show: false },
					axisTick: { show: false },
					splitLine: { lineStyle: { color: "rgba(128,128,128,0.15)" } },
				};

		return {
			grid: {
				top: legend ? 36 : 8,
				right: secondaryAxis ? 40 : 12,
				left: 0,
				bottom: 20,
				containLabel: true,
			},
			...(legend
				? {
						legend: {
							top: 4,
							right: 0,
							icon: "circle",
							itemWidth: 8,
							itemHeight: 8,
							textStyle: { fontSize: 12 },
							data: series.map((s) => ({
								name: s.label,
								itemStyle: { color: s.color },
							})),
						},
					}
				: {}),
			xAxis: {
				type: "category",
				data: xValues,
				axisLine: { show: false },
				axisTick: { show: false },
				axisLabel: { formatter: xFormatter ?? ((v: string) => formatChartDate(v)) },
			},
			yAxis,
			tooltip: { trigger: "axis" },
			series: series.map((s) => {
				const values = rows.map((d) => Number(d[s.key] ?? 0));
				if (s.type === "bar") {
					return {
						name: s.label,
						type: "bar",
						yAxisIndex: s.yAxisIndex ?? 0,
						data: values,
						itemStyle: { color: s.color, opacity: 0.85 },
					};
				}
				const withArea = s.area !== false;
				return {
					name: s.label,
					type: "line",
					yAxisIndex: s.yAxisIndex ?? 0,
					data: values,
					smooth: s.smooth ?? true,
					symbol: "none",
					lineStyle: { color: s.color, opacity: 0.85 },
					itemStyle: { color: s.color },
					...(withArea
						? { areaStyle: { color: s.color, opacity: s.areaOpacity ?? 0.3 } }
						: {}),
				};
			}),
		};
	}, [data, series, xField, xFormatter, secondaryAxis, legend]);

	return (
		<Card
			className={cn("flex flex-col gap-4 py-4", height ? undefined : "h-full", className)}
			style={height ? { height } : undefined}
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
				<div className="flex-1 min-h-[160px] w-full overflow-hidden">
					<ReactECharts option={option} style={{ height: "100%", width: "100%" }} />
				</div>
			</CardContent>
		</Card>
	);
}
