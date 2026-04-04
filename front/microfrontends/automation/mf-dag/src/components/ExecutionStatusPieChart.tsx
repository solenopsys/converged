import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Card, CardContent, CardDescription, CardHeader } from "front-core";

type Item = {
  key: string;
  label: string;
  value: number;
};

const COLORS = [
  "#3b82f6",
  "#22c55e",
  "#ef4444",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#84cc16",
  "#ec4899",
  "#14b8a6",
];
const ERROR_COLOR = "#ef4444";
const isErrorLike = (value: string) => /error|failed|failure|fail|ошиб/i.test(value);

export function ExecutionStatusPieChart({
  title,
  description,
  data,
}: {
  title: string;
  description?: string;
  data: Item[];
}) {
  const chartData = useMemo(
    () =>
      data
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value)
        .map((item, index) => ({
          ...item,
          color: isErrorLike(`${item.key} ${item.label}`) ? ERROR_COLOR : COLORS[index % COLORS.length],
        })),
    [data],
  );

  const option = useMemo(
    () => ({
      tooltip: {
        trigger: "item",
        formatter: (params: any) => `${params.name}: ${params.value.toLocaleString()}`,
      },
      series: [
        {
          type: "pie",
          radius: ["56px", "90px"],
          label: { show: false },
          emphasis: { label: { show: false } },
          data: chartData.map((item) => ({
            name: item.label,
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
        <CardDescription>{title}</CardDescription>
        {description ? <div className="text-xs text-muted-foreground">{description}</div> : null}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 px-4 pb-4 pt-0">
        {chartData.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            No data
          </div>
        ) : (
          <div className="h-full min-h-[220px] w-full overflow-hidden">
            <ReactECharts option={option} style={{ height: "100%", width: "100%" }} />
          </div>
        )}
      </CardContent>
      <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 pb-4 text-xs">
        {chartData.map((item) => (
          <div key={item.key} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
            <span className="font-mono text-foreground">{item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
