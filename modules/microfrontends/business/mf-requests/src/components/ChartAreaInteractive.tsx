"use client";

import { line, max, scaleLinear, scalePoint } from "d3";
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
	useGlobalTranslation,
	useIsMobile,
} from "front-core";
import * as React from "preact/compat";
import { useMemo } from "preact/compat";

type ChartAreaPoint = {
	date: string;
	requests: number;
	orders: number;
	conversion: number;
};

type AxisTooltipPoint = {
	axisValue: string;
	color: string;
	seriesName: string;
	value: number | string;
};

interface ChartAreaInteractiveProps {
	data?: ChartAreaPoint[];
	dashboardPin?: DashboardPinMeta;
}

function RequestConversionSvg({ data }: { data: ChartAreaPoint[] }) {
	const width = 640;
	const height = 250;
	const left = 44;
	const right = 48;
	const top = 12;
	const bottom = 28;
	const x = scalePoint().domain(data.map((point) => point.date)).range([left, width - right]);
	const primaryMax = Math.max(1, max(data.flatMap((point) => [point.requests, point.orders])) ?? 0);
	const conversionMax = Math.max(1, max(data, (point) => point.conversion) ?? 0);
	const primaryY = scaleLinear().domain([0, primaryMax]).nice().range([height - bottom, top]);
	const conversionY = scaleLinear().domain([0, conversionMax]).nice().range([height - bottom, top]);
	const draw = (value: (point: ChartAreaPoint) => number, y: typeof primaryY) =>
		line<ChartAreaPoint>()
			.x((point) => x(point.date) ?? left)
			.y((point) => y(value(point)))(data) ?? "";

	return (
		<svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="Request to order conversion chart">
			{primaryY.ticks(4).map((value) => (
				<g key={value}>
					<line x1={left} x2={width - right} y1={primaryY(value)} y2={primaryY(value)} stroke="currentColor" stroke-opacity="0.12" />
					<text x={left - 6} y={primaryY(value) + 4} text-anchor="end" className="fill-muted-foreground text-[10px]">{value}</text>
				</g>
			))}
			<path d={draw((point) => point.requests, primaryY)} fill="none" stroke="var(--ui-chart-1)" stroke-width="2" />
			<path d={draw((point) => point.orders, primaryY)} fill="none" stroke="var(--ui-chart-2)" stroke-width="2" />
			<path d={draw((point) => point.conversion, conversionY)} fill="none" stroke="var(--ui-chart-3)" stroke-width="2" />
		</svg>
	);
}

export function ChartAreaInteractive({
	data = [],
	dashboardPin = {
		id: "requests.request-to-order-conversion",
		title: "Request to Order Conversion",
		pinnedClassName: "min-h-[320px]",
	},
}: ChartAreaInteractiveProps) {
	const { t } = useGlobalTranslation("chart");
	const isMobile = useIsMobile();
	const [timeRange, setTimeRange] = React.useState("90d");

	const chartData = useMemo(() => {
		if (!Array.isArray(data)) return [];
		return data.filter(
			(item) => item && typeof item === "object" && !!item.date,
		);
	}, [data]);

	React.useEffect(() => {
		if (isMobile) setTimeRange("7d");
	}, [isMobile]);

	const filteredData = useMemo(() => {
		if (chartData.length === 0) return [];

		const validDates = chartData
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
		return chartData.filter((item) => {
			if (!item || typeof item !== "object" || !item.date) return false;
			return new Date(item.date) >= startDate;
		});
	}, [chartData, timeRange]);


	return (
		<Card className="@container/card" dashboardPin={dashboardPin}>
			<CardHeader>
				<CardTitle>{t("title")}</CardTitle>
				<CardDescription>
					<span className="hidden @[540px]/card:block">{t("description")}</span>
					<span className="@[540px]/card:hidden">{t("description_short")}</span>
				</CardDescription>
				<CardAction>
					<ToggleGroup
						type="single"
						value={timeRange}
						onValueChange={(value) => value && setTimeRange(value)}
						variant="outline"
						className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
					>
						<ToggleGroupItem value="90d">
							{t("time_ranges.90d")}
						</ToggleGroupItem>
						<ToggleGroupItem value="30d">
							{t("time_ranges.30d")}
						</ToggleGroupItem>
						<ToggleGroupItem value="7d">{t("time_ranges.7d")}</ToggleGroupItem>
					</ToggleGroup>
					<Select value={timeRange} onValueChange={setTimeRange}>
						<SelectTrigger
							className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
							size="sm"
							aria-label="Select a value"
						>
							<SelectValue placeholder={t("time_ranges.90d")} />
						</SelectTrigger>
						<SelectContent className="rounded-xl">
							<SelectItem value="90d" className="rounded-lg">
								{t("time_ranges.90d")}
							</SelectItem>
							<SelectItem value="30d" className="rounded-lg">
								{t("time_ranges.30d")}
							</SelectItem>
							<SelectItem value="7d" className="rounded-lg">
								{t("time_ranges.7d")}
							</SelectItem>
						</SelectContent>
					</Select>
				</CardAction>
			</CardHeader>
			<CardContent className="px-2 pt-2">
				<div className="h-[250px] w-full">
					{filteredData.length > 0 ? (
						<RequestConversionSvg data={filteredData} />
					) : (
						<div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
							No data yet
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
