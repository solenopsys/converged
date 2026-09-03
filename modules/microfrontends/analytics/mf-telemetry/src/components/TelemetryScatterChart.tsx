import { extent, scaleLinear, scaleTime } from "d3";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	type DashboardPinMeta,
} from "front-core";
import { useMemo } from "preact/compat";
import type { TelemetryEvent } from "../functions/types";

const OK = "var(--ui-success)";
const ELEVATED = "var(--ui-warning)";
const HIGH = "var(--ui-destructive)";
type ScatterTooltipPoint = {
	value: [number, number, string, string, string | undefined];
};

function TelemetryScatterSvg({
	data,
	metrics,
}: {
	data: ScatterTooltipPoint[];
	metrics: { avg: number; p95: number; max: number };
}) {
	const width = 640;
	const height = 300;
	const left = 40;
	const right = 36;
	const top = 16;
	const bottom = 30;
	const [minTime, maxTime] = extent(data, (point) => point.value[0]);
	const x = scaleTime()
		.domain([new Date(minTime ?? 0), new Date(maxTime ?? (minTime ?? 1) + 1)])
		.range([left, width - right]);
	const y = scaleLinear()
		.domain([0, Math.max(1, metrics.max)])
		.nice()
		.range([height - bottom, top]);

	return (
		<svg
			viewBox={`0 0 ${width} ${height}`}
			className="h-full w-full"
			role="img"
			aria-label="Telemetry scatter chart"
		>
			{y.ticks(4).map((value) => (
				<g key={value}>
					<line
						x1={left}
						x2={width - right}
						y1={y(value)}
						y2={y(value)}
						stroke="currentColor"
						stroke-opacity="0.12"
					/>
					<text
						x={left - 6}
						y={y(value) + 4}
						text-anchor="end"
						className="fill-muted-foreground text-[10px]"
					>
						{value}
					</text>
				</g>
			))}
			{[metrics.avg, metrics.p95]
				.filter((value) => value > 0)
				.map((value) => (
					<line
						key={value}
						x1={left}
						x2={width - right}
						y1={y(value)}
						y2={y(value)}
						stroke="currentColor"
						stroke-opacity="0.35"
						stroke-dasharray="4 4"
					/>
				))}
			{data.map((point, index) => {
				const value = point.value[1];
				const radius =
					value >= metrics.p95 ? 6 : value >= metrics.avg ? 4 : 2.5;
				const color =
					value >= metrics.p95 ? HIGH : value >= metrics.avg ? ELEVATED : OK;
				return (
					<circle
						key={`${point.value[0]}-${index}`}
						cx={x(new Date(point.value[0]))}
						cy={y(value)}
						r={radius}
						fill={color}
						fill-opacity="0.82"
					/>
				);
			})}
		</svg>
	);
}

function percentile(values: number[], p: number): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const index = Math.min(
		sorted.length - 1,
		Math.ceil((p / 100) * sorted.length) - 1,
	);
	return sorted[index] ?? 0;
}

export function TelemetryScatterChart({
	data = [],
	dashboardPin,
}: {
	data: TelemetryEvent[];
	dashboardPin?: DashboardPinMeta;
}) {
	const metrics = useMemo(() => {
		const values = data
			.map((item) => Number(item.value))
			.filter(Number.isFinite);
		const max = values.length ? Math.max(...values) : 0;
		const avg = values.length
			? values.reduce((sum, value) => sum + value, 0) / values.length
			: 0;
		return {
			max,
			avg: Number(avg.toFixed(2)),
			p95: percentile(values, 95),
		};
	}, [data]);

	const chartData = useMemo(
		() =>
			data
				.filter(
					(item) =>
						Number.isFinite(Number(item.ts)) &&
						Number.isFinite(Number(item.value)),
				)
				.sort((a, b) => a.ts - b.ts)
				.map((item) => [
					item.ts,
					Number(item.value),
					item.device_id,
					item.param,
					item.unit,
				]),
		[data],
	);

	return (
		<Card
			className="flex h-[360px] flex-col gap-4 py-4"
			dashboardPin={dashboardPin}
		>
			<CardHeader className="shrink-0 px-4 pb-2">
				<CardDescription>Hot telemetry scatter</CardDescription>
				<div className="text-xs text-muted-foreground">
					avg {metrics.avg.toLocaleString()} · p95{" "}
					{metrics.p95.toLocaleString()} · max {metrics.max.toLocaleString()}
				</div>
			</CardHeader>
			<CardContent className="flex min-h-0 flex-1 px-4 pb-4 pt-0">
				{chartData.length === 0 ? (
					<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
						No data
					</div>
				) : (
					<div className="h-full min-h-[220px] w-full overflow-hidden">
						<TelemetryScatterSvg
							data={chartData.map((value) => ({ value }))}
							metrics={metrics}
						/>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
