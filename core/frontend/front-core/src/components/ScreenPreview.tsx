export type ScreenPreviewProps = {
	/** Resolution in `width x height` form, for example `1920x1080`. */
	resolution?: string | null;
	/** Explicit pixel width. Used with `height` when resolution is not provided. */
	width?: number;
	height?: number;
	label?: string;
	class?: string;
};

/** A compact, proportional preview of a screen resolution. */
export function ScreenPreview({
	resolution,
	width: providedWidth,
	height: providedHeight,
	label,
	class: className = "",
}: ScreenPreviewProps) {
	const dimensions = parseResolution(resolution);
	const width = dimensions?.width ?? providedWidth;
	const height = dimensions?.height ?? providedHeight;
	if (!width || !height || width <= 0 || height <= 0) return null;

	const ratio = width / height;
	const orientation =
		ratio > 1 ? "Landscape" : ratio < 1 ? "Portrait" : "Square";
	const previewWidth = Math.min(160, 88 * ratio);

	return (
		<div
			class={`flex shrink-0 flex-col items-center gap-1.5 ${className}`}
			aria-label={`${orientation} screen, ${width} by ${height} pixels`}
			title={`${orientation} · ${width} × ${height}px`}
		>
			<div
				class="flex items-center justify-center rounded-md border-2 border-muted-foreground/50 bg-muted/30 p-1 text-xs font-medium text-foreground"
				style={{
					aspectRatio: `${width} / ${height}`,
					width: `${previewWidth}px`,
				}}
			>
				<span
					class={`whitespace-nowrap ${ratio < 0.8 ? "rotate-90 text-[10px]" : ""}`}
				>
					{width} × {height}
				</span>
			</div>
			<span class="text-xs text-muted-foreground">
				{label ? `${label} · ${orientation}` : orientation}
			</span>
		</div>
	);
}

function parseResolution(value?: string | null) {
	const match = value?.match(/^\s*(\d+)\s*[x×]\s*(\d+)\s*$/i);
	if (!match) return undefined;
	return { width: Number(match[1]), height: Number(match[2]) };
}
