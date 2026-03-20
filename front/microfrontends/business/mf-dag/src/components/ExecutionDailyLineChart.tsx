import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Card, CardContent, CardDescription, CardHeader } from "front-core";

type DailyPoint = {
  date: string;
  total: number;
  running: number;
  done: number;
  failed: number;
};

const COLORS = {
  total: "#3b82f6",
  running: "#f59e0b",
  done: "#22c55e",
  failed: "#ef4444",
};

export function ExecutionDailyLineChart({
  data = [],
  title,
  description,
}: {
  data: DailyPoint[];
  title?: string;
  description?: string;
}) {
  const option = useMemo(
    () => ({
      grid: { top: 36, right: 12, left: 0, bottom: 20, containLabel: true },
      legend: {
        top: 4,
        right: 0,
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { fontSize: 12 },
        data: [
          { name: "Total", itemStyle: { color: COLORS.total } },
          { name: "Running", itemStyle: { color: COLORS.running } },
          { name: "Done", itemStyle: { color: COLORS.done } },
          { name: "Failed", itemStyle: { color: COLORS.failed } },
        ],
      },
      xAxis: {
        type: "category",
        data: data.map((d) => d.date),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          formatter: (v: string) =>
            new Date(v).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
        },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "rgba(128,128,128,0.15)" } },
      },
      tooltip: { trigger: "axis" },
      series: [
        {
          name: "Total",
          type: "line",
          data: data.map((d) => d.total),
          smooth: true,
          symbol: "none",
          lineStyle: { color: COLORS.total, opacity: 0.9 },
          itemStyle: { color: COLORS.total },
          areaStyle: { color: COLORS.total, opacity: 0.2 },
        },
        {
          name: "Running",
          type: "line",
          data: data.map((d) => d.running),
          smooth: true,
          symbol: "none",
          lineStyle: { color: COLORS.running, opacity: 0.85 },
          itemStyle: { color: COLORS.running },
        },
        {
          name: "Done",
          type: "line",
          data: data.map((d) => d.done),
          smooth: true,
          symbol: "none",
          lineStyle: { color: COLORS.done, opacity: 0.85 },
          itemStyle: { color: COLORS.done },
        },
        {
          name: "Failed",
          type: "line",
          data: data.map((d) => d.failed),
          smooth: true,
          symbol: "none",
          lineStyle: { color: COLORS.failed, opacity: 0.85 },
          itemStyle: { color: COLORS.failed },
        },
      ],
    }),
    [data],
  );

  return (
    <Card className="flex h-full flex-col gap-4 py-4">
      {(title || description) && (
        <CardHeader className="shrink-0 px-4 pb-2">
          {title && <CardDescription>{title}</CardDescription>}
          {description && <div className="text-xs text-muted-foreground">{description}</div>}
        </CardHeader>
      )}
      <CardContent className="flex min-h-0 flex-1 px-4 pb-4 pt-0">
        <div className="min-h-[160px] w-full flex-1 overflow-hidden">
          <ReactECharts option={option} style={{ height: "100%", width: "100%" }} />
        </div>
      </CardContent>
    </Card>
  );
}
