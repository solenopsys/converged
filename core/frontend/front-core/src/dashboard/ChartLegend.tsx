import { translator } from "i18n";
import type { ComponentChildren } from "preact";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";

const t = translator(CHAT_MESSAGES_NAMESPACE);

export type ChartLegendRow = {
	key: string;
	label: string;
	color: string;
	value?: ComponentChildren;
};

export function ChartLegend({ rows }: { rows: ChartLegendRow[] }) {
	return (
		<table className="w-[clamp(180px,30%,280px)] max-w-full flex-none self-start border-collapse text-xs">
			<thead>
				<tr className="text-left text-muted-foreground">
					<th className="py-1 pr-3 font-medium">
						{t("statistics.chartMetric")}
					</th>
					<th className="py-1 text-right font-medium">
						{t("statistics.chartValue")}
					</th>
				</tr>
			</thead>
			<tbody>
				{rows.map((row) => (
					<tr key={row.key}>
						<td className="py-1 pr-3 text-muted-foreground">
							<span
								className="mr-1.5 inline-block h-2 w-2 rounded-[2px] align-middle"
								style={{ backgroundColor: row.color }}
							/>
							{row.label}
						</td>
						<td className="py-1 text-right font-mono text-foreground">
							{row.value ?? ""}
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
