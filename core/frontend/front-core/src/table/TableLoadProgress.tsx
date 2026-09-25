import { translator } from "i18n";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";

const t = translator(CHAT_MESSAGES_NAMESPACE);

type TableLoadProgressProps = {
	loaded: number;
	total: number;
	hasMore: boolean;
};

export function TableLoadProgress({
	loaded,
	total,
	hasMore,
}: TableLoadProgressProps) {
	if (loaded === 0 && total === 0) return null;

	const hasKnownTotal = !hasMore || total > loaded;
	const current = hasKnownTotal ? Math.min(loaded, total) : loaded;
	const percent =
		hasKnownTotal && total > 0 ? (current / total) * 100 : undefined;

	return (
		<div class="flex h-7 shrink-0 items-center gap-2 border-b px-3">
			<span class="shrink-0 text-xs tabular-nums text-muted-foreground">
				{current.toLocaleString()} /{" "}
				{hasKnownTotal ? total.toLocaleString() : "…"}
			</span>
			<div
				role="progressbar"
				aria-label={t("table.loadedRows")}
				aria-valuemin={hasKnownTotal ? 0 : undefined}
				aria-valuemax={hasKnownTotal ? total : undefined}
				aria-valuenow={hasKnownTotal ? current : undefined}
				class="h-1 w-24 overflow-hidden rounded-full bg-muted sm:w-36"
			>
				<div
					class={
						hasKnownTotal
							? "h-full bg-primary transition-[width]"
							: "h-full w-1/3 animate-pulse bg-primary"
					}
					style={percent === undefined ? undefined : { width: `${percent}%` }}
				/>
			</div>
		</div>
	);
}
