import type { ComponentChildren } from "preact";

export type ChartLegendRow = {
	key: string;
	label: string;
	color: string;
	value?: ComponentChildren;
};

export function ChartLegend({
	rows,
	caption,
	activeKey,
}: {
	rows: ChartLegendRow[];
	caption?: ComponentChildren;
	activeKey?: string | null;
}) {
	return (
		<div className="order-first w-[clamp(150px,30%,240px)] max-w-full flex-none self-start text-xs">
			<div className="flex flex-col">
				{rows.map((row) => (
					<div
						key={row.key}
						className={`flex items-center justify-between gap-3 rounded px-1 py-1 ${activeKey === row.key ? "bg-accent/50 font-semibold" : ""}`}
					>
						<span className="min-w-0 truncate text-muted-foreground">
							<span
								className="mr-1.5 inline-block h-2 w-2 rounded-[2px] align-middle"
								style={{ backgroundColor: row.color }}
							/>
							{row.label}
						</span>
						<span className="shrink-0 font-mono text-foreground">
							{row.value ?? ""}
						</span>
					</div>
				))}
			</div>
			{caption && (
				<div className="mt-2 text-xs text-muted-foreground">{caption}</div>
			)}
		</div>
	);
}
