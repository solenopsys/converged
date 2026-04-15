import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Card, CardContent, CardDescription, CardHeader } from "front-core";
import type { TelemetryEvent } from "../functions/types";

const GREEN = "#22c55e";
const YELLOW = "#f59e0b";
const RED = "#ef4444";

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

export function TelemetryScatterChart({ data = [] }: { data: TelemetryEvent[] }) {
  const metrics = useMemo(() => {
    const values = data.map((item) => Number(item.value)).filter(Number.isFinite);
    const max = values.length ? Math.max(...values) : 0;
    const avg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    return {
      max,
      avg: Number(avg.toFixed(2)),
      p95: percentile(values, 95),
    };
  }, [data]);

  const chartData = useMemo(
    () =>
      data
        .filter((item) => Number.isFinite(Number(item.ts)) && Number.isFinite(Number(item.value)))
        .sort((a, b) => a.ts - b.ts)
        .map((item) => [
          item.ts,
          Number(item.value),
          item.device_id,
          item.param,
          item.unit,
        ]),
    [data],
  );

  const option = useMemo(
    () => ({
      grid: { top: 28, right: 24, left: 12, bottom: 28, containLabel: true },
      tooltip: {
        trigger: "item",
        formatter: (params: any) => {
          const [ts, value, device, param, unit] = params.value;
          const date = new Date(ts).toLocaleString();
          return [
            `<b>${value.toLocaleString()} ${unit ?? ""}</b>`,
            date,
            `Device: ${device}`,
            `Param: ${param}`,
          ].join("<br/>");
        },
      },
      visualMap: {
        show: true,
        type: "continuous",
        min: 0,
        max: Math.max(metrics.max, 1),
        dimension: 1,
        right: 0,
        top: 16,
        itemWidth: 10,
        itemHeight: 120,
        textStyle: { color: "rgba(255,255,255,0.65)", fontSize: 11 },
        inRange: { color: [GREEN, YELLOW, RED] },
      },
      xAxis: {
        type: "time",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: "rgba(255,255,255,0.58)" },
      },
      yAxis: {
        type: "value",
        name: data[0]?.unit ?? "",
        nameTextStyle: { color: "rgba(255,255,255,0.58)" },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "rgba(255,255,255,0.58)" },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.12)" } },
      },
      series: [
        {
          name: "Telemetry",
          type: "scatter",
          data: chartData,
          symbolSize: (value: any) => {
            const ms = Number(value?.[1] ?? 0);
            if (ms >= metrics.p95 && metrics.p95 > 0) return 12;
            if (ms >= metrics.avg && metrics.avg > 0) return 8;
            return 5;
          },
          itemStyle: { opacity: 0.82 },
          large: chartData.length > 1000,
          largeThreshold: 1000,
          markLine: {
            symbol: "none",
            label: { color: "rgba(255,255,255,0.7)" },
            lineStyle: { color: "rgba(255,255,255,0.35)", type: "dashed" },
            data: [
              { yAxis: metrics.avg, name: "avg" },
              { yAxis: metrics.p95, name: "p95" },
            ].filter((item) => item.yAxis > 0),
          },
        },
      ],
    }),
    [chartData, data, metrics],
  );

  return (
    <Card className="flex h-[360px] flex-col gap-4 py-4">
      <CardHeader className="shrink-0 px-4 pb-2">
        <CardDescription>Hot telemetry scatter</CardDescription>
        <div className="text-xs text-muted-foreground">
          avg {metrics.avg.toLocaleString()} · p95 {metrics.p95.toLocaleString()} · max {metrics.max.toLocaleString()}
        </div>
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
    </Card>
  );
}
