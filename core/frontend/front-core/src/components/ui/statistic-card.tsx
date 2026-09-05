import { invokeAction } from "front-core/core";
import type * as React from "preact/compat";
import { useStatisticAction } from "../../dashboard/statistic-actions";
import { Loader2 } from "../../icons";
import { cn } from "../../lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	type DashboardPinMeta,
} from "./card";

type TrendDirection = "up" | "down" | "neutral";

export interface StatisticCardProps {
	title: string;
	/** Stable statistic key used to resolve a dashboard action independently of UI locale. */
	actionKey?: string;
	value: string | number;
	description?: string;
	icon?: React.ComponentType<{ className?: string }>;
	trend?: {
		value: string;
		label?: string;
		direction?: TrendDirection;
	};
	dashboardPin?: DashboardPinMeta;
	loading?: boolean;
	className?: string;
}

const trendClasses: Record<TrendDirection, string> = {
	up: "text-emerald-600",
	down: "text-rose-600",
	neutral: "text-muted-foreground",
};

export function StatisticCard({
	title,
	actionKey,
	value,
	description,
	icon: Icon,
	trend,
	dashboardPin,
	loading = false,
	className,
}: StatisticCardProps) {
	const actionId = useStatisticAction(actionKey ?? title);
	const trendClass = trend?.direction
		? trendClasses[trend.direction]
		: "text-muted-foreground";

	return (
		<Card className={className} dashboardPin={dashboardPin}>
			<CardHeader className="flex flex-row items-start justify-between gap-4">
				<div className="space-y-1">
					{actionId ? (
						<button
							type="button"
							className="block text-left text-primary underline decoration-dotted underline-offset-4 transition hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							onClick={() => void invokeAction(actionId)}
						>
							<CardDescription className="text-xs uppercase tracking-wide">
								{title}
							</CardDescription>
						</button>
					) : (
						<CardDescription className="text-xs uppercase tracking-wide">
							{title}
						</CardDescription>
					)}
					<CardTitle className="text-3xl font-semibold tabular-nums">
						{loading ? (
							<span className="inline-flex" role="status">
								<Loader2
									aria-label="Loading"
									className="h-6 w-6 animate-spin text-muted-foreground"
								/>
							</span>
						) : (
							value
						)}
					</CardTitle>
				</div>
				{Icon && (
					<div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
						<Icon className="h-5 w-5" />
					</div>
				)}
			</CardHeader>
			{(description || trend) && (
				<CardContent className="pt-1">
					{trend && (
						<div className={cn("text-xs font-medium", trendClass)}>
							{trend.value}
							{trend.label ? ` ${trend.label}` : ""}
						</div>
					)}
					{description && (
						<div className="text-xs text-muted-foreground">{description}</div>
					)}
				</CardContent>
			)}
		</Card>
	);
}
