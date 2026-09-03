export const CHART_COLORS = [
	"var(--ui-chart-1)",
	"var(--ui-chart-2)",
	"var(--ui-chart-3)",
	"var(--ui-chart-4)",
	"var(--ui-chart-5)",
	"var(--ui-chart-6)",
	"var(--ui-chart-7)",
	"var(--ui-chart-8)",
];

export const PIE_COLORS = CHART_COLORS;

export const ERROR_COLOR = "var(--ui-destructive)";

export function isErrorLike(value: string): boolean {
	return /error|failed|failure|fail|ошиб/i.test(value);
}
