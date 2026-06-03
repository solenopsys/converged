import ReactECharts from "echarts-for-react";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	type DashboardPinMeta,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	ToggleGroup,
	ToggleGroupItem,
	useIsMobile,
} from "front-core";
import { useEffect, useMemo, useState } from "react";

type ConversionPoint = {
	date: string;
	requests: number;
	orders: number;
	conversion: number;
};

export function OrderConversionChart({
	data = [],
	dashboardPin,
}: {
	data: ConversionPoint[];
	dashboardPin?: DashboardPinMeta;
}) {
	const isMobile = useIsMobile();
	const [timeRange, setTimeRange] = useState("90d");

	const filteredData = useMemo(() => {
		if (!Array.isArray(data) || data.length === 0) return [];
		const validDates = data
			.map((item) => new Date(item.date))
			.filter((date) => !Number.isNaN(date.getTime()));
		if (validDates.length === 0) return [];

		const referenceDate = new Date(
			Math.max(...validDates.map((date) => date.getTime())),
		);
		const daysToSubtract =
			timeRange === "30d" ? 30 : timeRange === "7d" ? 7 : 90;
		const startDate = new Date(referenceDate);
		startDate.setDate(startDate.getDate() - daysToSubtract);
		return data.filter((item) => new Date(item.date) >= startDate);
	}, [data, timeRange]);

	const option = useMemo(() => {
		const dates = filteredData.map((point) => point.date);
		return {
			grid: { top: 8, right: 48, left: 42, bottom: 8, containLabel: true },
			xAxis: {
				type: "category",
				data: dates,
				axisLine: { show: false },
				axisTick: { show: false },
				axisLabel: {
					interval: Math.max(0, Math.floor(dates.length / 6) - 1),
					formatter: (value: string) =>
						new Date(value).toLocaleDateString("en-US", {
							month: "short",
							day: "numeric",
						}),
				},
			},
			yAxis: [
				{
					type: "value",
					position: "left",
					axisLine: { show: false },
					axisTick: { show: false },
					splitLine: { lineStyle: { color: "rgba(128,128,128,0.15)" } },
				},
				{
					type: "value",
					position: "right",
					axisLine: { show: false },
					axisTick: { show: false },
					splitLine: { show: false },
					axisLabel: { formatter: (value: number) => `${value}%` },
				},
			],
			tooltip: { trigger: "axis" },
			series: [
				{
					name: "Requests",
					type: "line",
					yAxisIndex: 0,
					data: filteredData.map((point) => point.requests),
					smooth: true,
					symbol: "none",
					lineStyle: { color: "#64748b", opacity: 0.9 },
					itemStyle: { color: "#64748b" },
					areaStyle: { color: "#64748b", opacity: 0.16 },
				},
				{
					name: "Orders",
					type: "line",
					yAxisIndex: 0,
					data: filteredData.map((point) => point.orders),
					smooth: true,
					symbol: "none",
					lineStyle: { color: "#0f766e", opacity: 0.9 },
					itemStyle: { color: "#0f766e" },
					areaStyle: { color: "#0f766e", opacity: 0.18 },
				},
				{
					name: "Conversion",
					type: "line",
					yAxisIndex: 1,
					data: filteredData.map((point) => point.conversion),
					smooth: true,
					symbol: "none",
					lineStyle: { color: "#f59e0b", opacity: 0.9 },
					itemStyle: { color: "#f59e0b" },
				},
			],
		};
	}, [filteredData]);

	useEffect(() => {
		if (isMobile) setTimeRange("7d");
	}, [isMobile]);

	return (
		<Card className="@container/card" dashboardPin={dashboardPin}>
			<CardHeader>
				<CardTitle>Request to Order Conversion</CardTitle>
				<CardDescription>
					Requests and accepted production orders
				</CardDescription>
				<CardAction>
					<ToggleGroup
						type="single"
						value={timeRange}
						onValueChange={(value) => value && setTimeRange(value)}
						variant="outline"
						className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
					>
						<ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
						<ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
						<ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
					</ToggleGroup>
					<Select value={timeRange} onValueChange={setTimeRange}>
						<SelectTrigger
							className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
							size="sm"
							aria-label="Select range"
						>
							<SelectValue placeholder="Last 3 months" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="90d">Last 3 months</SelectItem>
							<SelectItem value="30d">Last 30 days</SelectItem>
							<SelectItem value="7d">Last 7 days</SelectItem>
						</SelectContent>
					</Select>
				</CardAction>
			</CardHeader>
			<CardContent className="px-2 pt-2">
				<div className="h-[250px] w-full">
					{filteredData.length > 0 ? (
						<ReactECharts
							option={option}
							style={{ height: "100%", width: "100%" }}
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
							No order data yet
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
