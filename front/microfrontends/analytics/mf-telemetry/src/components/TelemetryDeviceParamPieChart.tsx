import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Card, CardContent, CardDescription, CardHeader } from "front-core";
import type { TelemetryEvent } from "../functions/types";

const COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#f97316",
  "#84cc16",
  "#ec4899",
  "#14b8a6",
  "#a855f7",
];

export function TelemetryDeviceParamPieChart({ data = [] }: { data: TelemetryEvent[] }) {
  const chartData = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const item of data) {
      const key = `${item.device_id || "unknown"} / ${item.param || "unknown"}`;
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }

    const sorted = [...grouped.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const visible = sorted.slice(0, 9);
    const other = sorted.slice(9).reduce((sum, item) => sum + item.value, 0);
    if (other > 0) {
      visible.push({ name: "Other", value: other });
    }

    return visible.map((item, index) => ({
      ...item,
      color: COLORS[index % COLORS.length],
    }));
  }, [data]);

  const option = useMemo(
    () => ({
      tooltip: {
        trigger: "item",
        formatter: (params: any) => `${params.name}: ${params.value.toLocaleString()}`,
      },
      series: [
        {
          type: "pie",
          radius: ["58px", "92px"],
          label: { show: false },
          emphasis: { label: { show: false } },
          data: chartData.map((item) => ({
            name: item.name,
            value: item.value,
            itemStyle: { color: item.color },
          })),
        },
      ],
    }),
    [chartData],
  );

  return (
    <Card className="flex h-[360px] flex-col gap-4 py-4">
      <CardHeader className="shrink-0 px-4 pb-2">
        <CardDescription>Device / param distribution</CardDescription>
        <div className="text-xs text-muted-foreground">Hot telemetry events by source and metric</div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 px-4 pb-4 pt-0">
        {chartData.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">No data</div>
        ) : (
          <div className="h-full min-h-[220px] w-full overflow-hidden">
            <ReactECharts option={option} style={{ height: "100%", width: "100%" }} />
          </div>
        )}
      </CardContent>
      <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 pb-4 text-xs">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
            <span>{item.name}</span>
            <span className="font-mono text-foreground">{item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
