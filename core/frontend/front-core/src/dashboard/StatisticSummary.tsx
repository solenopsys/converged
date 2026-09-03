import { invokeAction } from "front-core/core";
import type { ComponentChildren } from "preact";
import { cn } from "../lib/utils";
import { useStatisticAction } from "./statistic-actions";

// The readout a collapsed section shows: a few headline numbers and one
// monochrome trend line. It is the camera's LCD panel — legible at a glance,
// no color needed to read it, and cheap enough to leave on screen for every
// service at once. Color and interaction belong to the charts inside the
// section, which only render once it is opened.

/** 1,284 below ten thousand; 12.9K above it. Proportional figures, not tabular. */
export function formatSummaryValue(value: number | string): string {
	if (typeof value === "string") return value;
	if (!Number.isFinite(value)) return "—";

	return Math.abs(value) < 10_000
		? new Intl.NumberFormat(undefined).format(value)
		: new Intl.NumberFormat(undefined, {
				notation: "compact",
				maximumFractionDigits: 1,
			}).format(value);
}

const SPARK_WIDTH = 96;
const SPARK_HEIGHT = 28;
const SPARK_POINTS = 12;
const STROKE = 2;
const END_RADIUS = 4;

function sparkPath(
	values: number[],
): { d: string; last: [number, number] } | null {
	if (values.length < 2) return null;

	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min;
	// Inset by the mark's own weight so the stroke and the end dot's ring are
	// never clipped by the viewBox.
	const padding = END_RADIUS + STROKE / 2;
	const usableWidth = SPARK_WIDTH - padding * 2;
	const usableHeight = SPARK_HEIGHT - padding * 2;

	const points = values.map((value, index): [number, number] => [
		padding + (usableWidth * index) / (values.length - 1),
		// A flat series sits on the centre line rather than collapsing onto an edge.
		padding +
			(span === 0
				? usableHeight / 2
				: usableHeight * (1 - (value - min) / span)),
	]);

	return {
		d: points
			.map(
				([x, y], index) =>
					`${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`,
			)
			.join(" "),
		last: points[points.length - 1],
	};
}

/**
 * One series, so no legend: the metric beside it names what is plotted. The line
 * is de-emphasised and the current period carries the accent — in a monochrome
 * readout that is muted ink against foreground ink.
 */
export function Sparkline({
	values,
	label,
	className,
}: {
	values: readonly number[];
	/** Read out to assistive technology in place of the plot. */
	label: string;
	className?: string;
}) {
	const path = sparkPath(
		values.slice(-SPARK_POINTS).map(Number).filter(Number.isFinite),
	);
	if (!path) return null;

	return (
		<svg
			className={cn(
				"hidden shrink-0 text-muted-foreground lg:block",
				className,
			)}
			width={SPARK_WIDTH}
			height={SPARK_HEIGHT}
			viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
			role="img"
			aria-label={label}
		>
			<path
				d={path.d}
				fill="none"
				stroke="currentColor"
				strokeWidth={STROKE}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			{/* The current period, ringed in the surface colour so it stays legible
			    where it sits on the line. */}
			<circle
				cx={path.last[0]}
				cy={path.last[1]}
				r={END_RADIUS}
				className="fill-foreground stroke-card"
				strokeWidth={STROKE}
			/>
		</svg>
	);
}

export function SummaryMetric({
	label,
	value,
}: {
	/** Sentence case, no trailing colon. */
	label: string;
	value: number | string;
}) {
	const actionId = useStatisticAction(label);
	const content = (
		<>
			<span className="truncate text-[0.6875rem] leading-none uppercase tracking-wide text-muted-foreground">
				{label}
			</span>
			<span className="text-lg leading-none font-semibold text-foreground">
				{formatSummaryValue(value)}
			</span>
		</>
	);

	if (actionId) {
		return (
			<button
				type="button"
				className="flex min-w-0 shrink-0 flex-col gap-0.5 text-left text-primary underline decoration-dotted underline-offset-4 transition hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				onClick={() => void invokeAction(actionId)}
			>
				{content}
			</button>
		);
	}

	return (
		<span className="flex min-w-0 shrink-0 flex-col gap-0.5">{content}</span>
	);
}

export function StatisticSummary({
	children,
	className,
}: {
	children: ComponentChildren;
	className?: string;
}) {
	return (
		<div className={cn("flex items-center gap-5", className)}>{children}</div>
	);
}
