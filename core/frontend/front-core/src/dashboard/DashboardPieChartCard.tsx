import { arc as d3Arc, pie as d3Pie } from "d3";
import { useMemo } from "preact/compat";
import { Card, CardContent, CardDescription, CardHeader, type DashboardPinMeta } from "../components/ui/card";
import { cn } from "../lib/utils";
import { ERROR_COLOR, isErrorLike as defaultIsErrorLike, PIE_COLORS } from "./pie-chart-colors";

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
	radius?: [number, number];
	maxSlices?: number;
	otherLabel?: string;
	legend?: boolean;
	className?: string;
}

const VIEW_SIZE = 180;

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
	radius = [56, 90],
	maxSlices,
	otherLabel = "Other",
	legend = true,
	className,
}: DashboardPieChartCardProps) {
	const chartData = useMemo(() => {
		const sorted = data.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);

		// Палитра назначается по порядку и не зацикливается: ряд, которому не
		// хватило слота, сворачивается в «прочее», а не получает цвет первого —
		// иначе два разных ряда на одном чарте выглядят одним. Отсюда и предел по
		// умолчанию: видимых на один меньше, чем цветов, последний слот за «прочим».
		const sliceLimit = Math.min(maxSlices ?? Number.POSITIVE_INFINITY, colors.length - 1);
		const visible = sorted.slice(0, sliceLimit);
		const rest = sorted.slice(sliceLimit);
		const otherValue = rest.reduce((sum, item) => sum + item.value, 0);
		const combined =
			otherValue > 0 ? [...visible, { key: "__other__", label: otherLabel, value: otherValue }] : visible;

		return combined.map((item, index) => ({
			...item,
			color: isErrorLike(`${item.key} ${item.label}`) ? errorColor : colors[index],
		}));
	}, [data, maxSlices, otherLabel, isErrorLike, errorColor, colors]);

	const arcs = useMemo(() => {
		if (chartData.length === 0) return [];
		const [innerRadius, outerRadius] = radius;
		const pieLayout = d3Pie<(typeof chartData)[number]>().value((item) => item.value).sort(null);
		const arcGenerator = d3Arc<ReturnType<typeof pieLayout>[number]>()
			.innerRadius(innerRadius)
			.outerRadius(outerRadius);
		return pieLayout(chartData).map((slice) => ({
			path: arcGenerator(slice) ?? "",
			datum: slice.data,
		}));
	}, [chartData, radius]);

	return (
		<Card className={cn("flex flex-col gap-4 py-4", className)} style={{ height }} dashboardPin={dashboardPin}>
			{(title || description) && (
				<CardHeader className="shrink-0 px-4 pb-2">
					{title && <CardDescription>{title}</CardDescription>}
					{description && <div className="text-xs text-muted-foreground">{description}</div>}
				</CardHeader>
			)}
			<CardContent className="flex min-h-0 flex-1 px-4 pb-4 pt-0">
				{chartData.length === 0 ? (
					<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
						{emptyLabel}
					</div>
				) : (
					<div className="flex h-full min-h-[220px] w-full items-center justify-center overflow-hidden">
						<svg
							viewBox={`${-VIEW_SIZE / 2} ${-VIEW_SIZE / 2} ${VIEW_SIZE} ${VIEW_SIZE}`}
							className="h-full max-h-full w-auto"
							role="img"
							aria-label={title ?? "Pie chart"}
						>
							{arcs.map(({ path, datum }) => (
								<path key={datum.key} d={path} fill={datum.color}>
									<title>
										{datum.label}: {datum.value.toLocaleString()}
									</title>
								</path>
							))}
						</svg>
					</div>
				)}
			</CardContent>
			{legend && chartData.length > 0 && (
				<div className="flex flex-wrap gap-x-4 gap-y-2 px-4 pb-4 text-xs">
					{chartData.map((item) => (
						<div key={item.key} className="flex items-center gap-1.5 text-muted-foreground">
							<span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
							<span>{item.label}</span>
							<span className="font-mono text-foreground">{item.value.toLocaleString()}</span>
						</div>
					))}
				</div>
			)}
		</Card>
	);
}
