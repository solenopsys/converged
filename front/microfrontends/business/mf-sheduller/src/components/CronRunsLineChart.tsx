import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Card, CardContent, CardDescription, CardHeader } from "front-core";

type DailyRun = {
  date: string;
  total: number;
  success: number;
  failed: number;
};

const COLORS = {
  total: "#3b82f6",
  success: "#22c55e",
  failed: "#ef4444",
};

export function CronRunsLineChart({ data = [] }: { data: DailyRun[] }) {
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
          { name: "Runs", itemStyle: { color: COLORS.total } },
          { name: "Success", itemStyle: { color: COLORS.success } },
          { name: "Failed", itemStyle: { color: COLORS.failed } },
        ],
      },
      xAxis: {
        type: "category",
        data: data.map((d) => d.date),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          formatter: (value: string) =>
            new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
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
          name: "Runs",
          type: "line",
          data: data.map((d) => d.total),
          smooth: true,
          symbol: "none",
          lineStyle: { color: COLORS.total, opacity: 0.85 },
          itemStyle: { color: COLORS.total },
          areaStyle: { color: COLORS.total, opacity: 0.18 },
        },
        {
          name: "Success",
          type: "line",
          data: data.map((d) => d.success),
          smooth: true,
          symbol: "none",
          lineStyle: { color: COLORS.success, opacity: 0.85 },
          itemStyle: { color: COLORS.success },
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
      <CardHeader className="shrink-0 px-4 pb-2">
        <CardDescription>Daily runs</CardDescription>
        <div className="text-xs text-muted-foreground">Scheduler runs by day</div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 px-4 pb-4 pt-0">
        <div className="min-h-[160px] w-full flex-1 overflow-hidden">
          <ReactECharts option={option} style={{ height: "100%", width: "100%" }} />
        </div>
      </CardContent>
    </Card>
  );
}
