/**
 * Категориальная палитра чартов. Значения живут в токенах
 * (`styles/tokens.css` → `--hw-chart-*` → `--ui-chart-*`), здесь только порядок
 * слотов: он и есть механизм различимости при дальтонизме, поэтому цвета
 * назначаются по порядку и палитра не зацикливается — что не влезло в восемь
 * рядов, сворачивается в «прочее».
 *
 * Чарты рисуются в SVG, поэтому `var()` резолвит браузер и смена темы не
 * требует ни перерисовки, ни чтения computed style.
 */
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

/** Историческое имя того же списка: им пользуются карточки дашборда и MF. */
export const PIE_COLORS = CHART_COLORS;

/** Статус, а не ряд: ошибка всегда красная, в каком бы слоте ни оказалась. */
export const ERROR_COLOR = "var(--ui-destructive)";

export function isErrorLike(value: string): boolean {
	return /error|failed|failure|fail|ошиб/i.test(value);
}
