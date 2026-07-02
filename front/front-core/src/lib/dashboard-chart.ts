export const PIE_COLORS = [
	"#3b82f6",
	"#22c55e",
	"#f59e0b",
	"#ef4444",
	"#8b5cf6",
	"#06b6d4",
	"#f97316",
	"#84cc16",
	"#ec4899",
	"#14b8a6",
];

export const ERROR_COLOR = "#ef4444";

export function isErrorLike(value: string): boolean {
	return /error|failed|failure|fail|ошиб/i.test(value);
}

export function formatChartDate(value: string, locale = "en-US"): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}
	return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}
