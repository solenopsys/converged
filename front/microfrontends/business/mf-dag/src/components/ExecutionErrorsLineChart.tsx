import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Card, CardContent, CardDescription, CardHeader } from "front-core";

type DailyPoint = {
  date: string;
  total: number;
  failed: number;
};

const COLORS = {
  failed: "#ef4444",
  rate: "#f97316",
};

export function ExecutionErrorsLineChart({
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
      grid: { top: 36, right: 40, left: 0, bottom: 20, containLabel: true },
      legend: {
        top: 4,
        right: 0,
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { fontSize: 12 },
        data: [
          { name: "Errors", itemStyle: { color: COLORS.failed } },
          { name: "Error rate %", itemStyle: { color: COLORS.rate } },
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
      yAxis: [
        {
          type: "value",
          name: "Errors",
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: "rgba(128,128,128,0.15)" } },
        },
        {
          type: "value",
          name: "%",
          min: 0,
          max: 100,
          splitLine: { show: false },
        },
      ],
      tooltip: { trigger: "axis" },
      series: [
        {
          name: "Errors",
          type: "bar",
          data: data.map((d) => d.failed),
          itemStyle: { color: COLORS.failed, opacity: 0.85 },
        },
        {
          name: "Error rate %",
          type: "line",
          yAxisIndex: 1,
          smooth: true,
          symbol: "none",
          data: data.map((d) => {
            if (!d.total) return 0;
            return Number(((d.failed / d.total) * 100).toFixed(2));
          }),
          lineStyle: { color: COLORS.rate, opacity: 0.95 },
          itemStyle: { color: COLORS.rate },
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
