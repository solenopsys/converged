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
	useIsMobile,
} from "front-core";
import { useEffect, useMemo, useState } from "preact/compat";

type ConversionPoint = {
	date: string;
	requests: number;
	orders: number;
	conversion: number;
};

function ConversionChartSvg({ data }: { data: ConversionPoint[] }) {
	const width = 640;
	const height = 250;
	const left = 42;
	const right = 48;
	const top = 12;
	const bottom = 28;
	const x = scalePoint()
		.domain(data.map((point) => point.date))
		.range([left, width - right]);
	const primaryMax = Math.max(
		1,
		max(data.flatMap((point) => [point.requests, point.orders])) ?? 0,
	);
	const conversionMax = Math.max(1, max(data, (point) => point.conversion) ?? 0);
	const primaryY = scaleLinear().domain([0, primaryMax]).nice().range([height - bottom, top]);
	const conversionY = scaleLinear().domain([0, conversionMax]).nice().range([height - bottom, top]);
	const draw = (value: (point: ConversionPoint) => number, y: typeof primaryY) =>
		line<ConversionPoint>()
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
			<text x={width - right + 6} y={top + 8} className="fill-muted-foreground text-[10px]">%</text>
		</svg>
	);
}

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
						<ConversionChartSvg data={filteredData} />
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
