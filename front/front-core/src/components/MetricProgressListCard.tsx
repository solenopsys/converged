import { cn } from "../lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	type DashboardPinMeta,
} from "./ui/card";
import { Progress } from "./ui/progress";

export type MetricProgressListMetric = {
	key: string;
	label: string;
	value: number | string;
	color?: string;
};

export type MetricProgressListItem = {
	id: string;
	title: string;
	subtitle?: string;
	value?: string;
	progress: number;
	metrics?: MetricProgressListMetric[];
};

export type MetricProgressListCardProps = {
	title: string;
	description?: string;
	items?: MetricProgressListItem[];
	emptyLabel?: string;
	progressLabel?: string;
	metricsLabel?: string;
	className?: string;
	contentClassName?: string;
	dashboardPin?: DashboardPinMeta | false;
};

function clampProgress(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(100, value));
}

function formatProgress(value: number): string {
	return `${clampProgress(value).toFixed(1)}%`;
}

function formatMetricValue(value: number | string): string {
	return typeof value === "number" ? value.toLocaleString() : value;
}

export function MetricProgressListCard({
	title,
	description,
	items = [],
	emptyLabel = "No data",
	progressLabel = "Progress",
	metricsLabel = "Metrics",
	className,
	contentClassName,
	dashboardPin,
}: MetricProgressListCardProps) {
	return (
		<Card
			className={cn("flex h-full min-h-[320px] flex-col py-4", className)}
			dashboardPin={dashboardPin}
		>
			<CardHeader className="shrink-0 px-4 pb-2">
				<CardDescription>{title}</CardDescription>
				{description ? (
					<div className="text-xs text-muted-foreground">{description}</div>
				) : null}
			</CardHeader>
			<CardContent
				className={cn("min-h-0 flex-1 overflow-auto px-4 pb-4 pt-0", contentClassName)}
			>
				{items.length === 0 ? (
					<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
						{emptyLabel}
					</div>
				) : (
					<div className="min-w-[680px] space-y-2">
						<div className="grid grid-cols-[minmax(180px,1fr)_100px_minmax(180px,260px)_220px] gap-3 border-b border-border/60 pb-2 text-xs text-muted-foreground">
							<div>Name</div>
							<div className="text-right">Value</div>
							<div>{progressLabel}</div>
							<div>{metricsLabel}</div>
						</div>
						{items.map((item) => {
							const progress = clampProgress(item.progress);
							return (
								<div
									key={item.id}
									className="grid grid-cols-[minmax(180px,1fr)_100px_minmax(180px,260px)_220px] items-center gap-3 py-1.5 text-sm"
								>
									<div className="min-w-0">
										<div className="truncate font-medium text-foreground">
											{item.title}
										</div>
										{item.subtitle ? (
											<div className="truncate text-xs text-muted-foreground">
												{item.subtitle}
											</div>
										) : null}
									</div>
									<div className="text-right font-mono text-xs">
										{item.value ?? ""}
									</div>
									<div className="flex items-center gap-2">
										<Progress value={progress} className="h-2 rounded-sm" />
										<div className="w-12 text-right font-mono text-xs">
											{formatProgress(progress)}
										</div>
									</div>
									<div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
										{(item.metrics ?? []).map((metric) => (
											<span
												key={metric.key}
												className="inline-flex items-center gap-1"
												title={metric.label}
											>
												{metric.color ? (
													<span
														className="h-2 w-2 rounded-[2px]"
														style={{ backgroundColor: metric.color }}
													/>
												) : null}
												<span>{metric.label}</span>
												<span className="font-mono text-foreground">
													{formatMetricValue(metric.value)}
												</span>
											</span>
										))}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
