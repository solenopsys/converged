import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Card, CardContent, CardDescription, CardHeader } from "front-core";

const COLORS = ["#22c55e", "#6b7280"];
const ERROR_COLOR = "#ef4444";
const isErrorLike = (value: string) => /error|failed|failure|fail|ошиб/i.test(value);

export function CronStatusPieChart({
  active,
  paused,
}: {
  active: number;
  paused: number;
}) {
  const data = useMemo(
    () => [
      { key: "active", label: "Active", value: Number(active ?? 0), color: isErrorLike("active") ? ERROR_COLOR : COLORS[0] },
      { key: "paused", label: "Paused", value: Number(paused ?? 0), color: isErrorLike("paused") ? ERROR_COLOR : COLORS[1] },
    ].filter((item) => item.value > 0),
    [active, paused],
  );

  const option = useMemo(
    () => ({
      tooltip: { trigger: "item" },
      series: [
        {
          type: "pie",
          radius: ["56px", "90px"],
          label: { show: false },
          data: data.map((item) => ({
            name: item.label,
            value: item.value,
            itemStyle: { color: item.color },
          })),
        },
      ],
    }),
    [data],
  );

  return (
    <Card className="flex h-[320px] flex-col gap-4 py-4">
      <CardHeader className="px-4 pb-2">
        <CardDescription>Cron status</CardDescription>
        <div className="text-xs text-muted-foreground">Active vs paused crons</div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 px-4 pb-4 pt-0">
        {data.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">No data</div>
        ) : (
          <div className="h-full min-h-[180px] w-full overflow-hidden">
            <ReactECharts option={option} style={{ height: "100%", width: "100%" }} />
          </div>
        )}
      </CardContent>
      <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 pb-4 text-xs">
        {data.map((item) => (
          <div key={item.key} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
            <span className="font-mono text-foreground">{item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
