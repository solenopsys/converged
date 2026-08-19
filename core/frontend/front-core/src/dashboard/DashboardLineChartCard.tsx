import { curveLinear, curveMonotoneX, line as d3Line, max as d3Max, min as d3Min, scaleBand, scaleLinear } from "d3";
import { useMemo } from "preact/compat";
import { Card, CardContent, CardDescription, CardHeader, type DashboardPinMeta } from "../components/ui/card";
import { cn } from "../lib/utils";

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

function defaultXFormatter(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 240;
const MARGIN = { top: 8, right: 36, bottom: 24, left: 36 };

export function DashboardLineChartCard({
	data,
	series,
	title,
	description,
	xField = "date",
	xFormatter = defaultXFormatter,
	secondaryAxis,
	dashboardPin,
	height,
	legend = true,
	className,
}: DashboardLineChartCardProps) {
	const rows = data as Record<string, unknown>[];

	const chart = useMemo(() => {
		const innerWidth = VIEW_WIDTH - MARGIN.left - MARGIN.right;
		const innerHeight = VIEW_HEIGHT - MARGIN.top - MARGIN.bottom;

		const xScale = scaleBand<string>()
			.domain(rows.map((row) => String(row[xField] ?? "")))
			.range([0, innerWidth])
			.padding(0.2);

		const valuesFor = (yAxisIndex: 0 | 1) =>
			series
				.filter((s) => (s.yAxisIndex ?? 0) === yAxisIndex)
				.flatMap((s) => rows.map((row) => Number(row[s.key] ?? 0)));

		const makeYScale = (yAxisIndex: 0 | 1, axisConfig?: DashboardSecondaryAxisConfig) => {
			const values = valuesFor(yAxisIndex);
			const domainMin = axisConfig?.min ?? Math.min(0, d3Min(values) ?? 0);
			const domainMax = axisConfig?.max ?? Math.max(1, d3Max(values) ?? 1);
			return scaleLinear().domain([domainMin, domainMax]).nice().range([innerHeight, 0]);
		};

		const yScale0 = makeYScale(0);
		const yScale1 = secondaryAxis ? makeYScale(1, secondaryAxis) : yScale0;
		const yScaleFor = (yAxisIndex: 0 | 1) => (yAxisIndex === 1 ? yScale1 : yScale0);

		const bandWidth = xScale.bandwidth();
		const barSeries = series.filter((s) => s.type === "bar");
		const barWidth = barSeries.length > 0 ? bandWidth / barSeries.length : bandWidth;

		const shapes = series.map((s, seriesIndex) => {
			const yScale = yScaleFor(s.yAxisIndex ?? 0);
			const points = rows.map((row) => ({
				x: (xScale(String(row[xField] ?? "")) ?? 0) + bandWidth / 2,
				y: yScale(Number(row[s.key] ?? 0)),
				value: Number(row[s.key] ?? 0),
				label: String(row[xField] ?? ""),
			}));

			if (s.type === "bar") {
				const barIndex = barSeries.indexOf(s);
				return {
					config: s,
					kind: "bar" as const,
					bars: points.map((point) => ({
						...point,
						x: point.x - bandWidth / 2 + barIndex * barWidth,
						width: barWidth,
						height: innerHeight - point.y,
					})),
				};
			}

			const lineGenerator = d3Line<{ x: number; y: number }>()
				.x((point) => point.x)
				.y((point) => point.y)
				.curve((s.smooth ?? true) ? curveMonotoneX : curveLinear);
			const areaEnabled = s.area !== false;

			return {
				config: s,
				kind: "line" as const,
				path: lineGenerator(points) ?? "",
				areaPath: areaEnabled
					? `${lineGenerator(points) ?? ""} L${points[points.length - 1]?.x ?? 0},${innerHeight} L${points[0]?.x ?? 0},${innerHeight} Z`
					: null,
				areaOpacity: s.areaOpacity ?? 0.3,
				points,
				seriesIndex,
			};
		});

		const xTicks = xScale.domain().filter((_, index, arr) => {
			const step = Math.max(1, Math.ceil(arr.length / 8));
			return index % step === 0;
		});

		return { innerWidth, innerHeight, shapes, xScale, xTicks };
	}, [rows, series, xField, secondaryAxis]);

	return (
		<Card
			className={cn("flex flex-col gap-4 py-4", height ? undefined : "h-full", className)}
			style={height ? { height } : undefined}
			dashboardPin={dashboardPin}
		>
			{(title || description) && (
				<CardHeader className="shrink-0 px-4 pb-2">
					{title && <CardDescription>{title}</CardDescription>}
					{description && <div className="text-xs text-muted-foreground">{description}</div>}
				</CardHeader>
			)}
			<CardContent className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-4 pt-0">
				{legend && (
					<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
						{series.map((s) => (
							<div key={s.key} className="flex items-center gap-1.5">
								<span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: s.color }} />
								<span>{s.label}</span>
							</div>
						))}
					</div>
				)}
				<div className="flex-1 min-h-[160px] w-full overflow-hidden">
					<svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className="h-full w-full" role="img" aria-label={title}>
						<g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
							<line
								x1={0}
								y1={chart.innerHeight}
								x2={chart.innerWidth}
								y2={chart.innerHeight}
								stroke="currentColor"
								className="text-border"
							/>
							{chart.xTicks.map((tick) => (
								<text
									key={tick}
									x={(chart.xScale(tick) ?? 0) + chart.xScale.bandwidth() / 2}
									y={chart.innerHeight + 14}
									textAnchor="middle"
									className="fill-muted-foreground"
									fontSize={9}
								>
									{xFormatter(tick)}
								</text>
							))}
							{chart.shapes.map((shape) =>
								shape.kind === "bar" ? (
									<g key={shape.config.key}>
										{shape.bars.map((bar) => (
											<rect
												key={`${shape.config.key}-${bar.label}`}
												x={bar.x}
												y={bar.y}
												width={Math.max(0, bar.width - 1)}
												height={Math.max(0, bar.height)}
												fill={shape.config.color}
												opacity={0.85}
											>
												<title>
													{shape.config.label}: {bar.value.toLocaleString()}
												</title>
											</rect>
										))}
									</g>
								) : (
									<g key={shape.config.key}>
										{shape.areaPath && (
											<path d={shape.areaPath} fill={shape.config.color} opacity={shape.areaOpacity} stroke="none" />
										)}
										<path d={shape.path} fill="none" stroke={shape.config.color} strokeWidth={2} opacity={0.9} />
										{shape.points.map((point) => (
											<circle key={`${shape.config.key}-${point.label}`} cx={point.x} cy={point.y} r={2.5} fill={shape.config.color}>
												<title>
													{shape.config.label}: {point.value.toLocaleString()}
												</title>
											</circle>
										))}
									</g>
								),
							)}
						</g>
					</svg>
				</div>
			</CardContent>
		</Card>
	);
}
