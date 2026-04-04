import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Card, CardContent, CardDescription, CardHeader } from "front-core";

type DailyPoint = {
  date: string;
  total: number;
  failed: number;
};

const COLORS = {
  wfFailed: "#ef4444",
  nodeFailed: "#f97316",
  rate: "#facc15",
};

export function ExecutionErrorsLineChart({
  data = [],
  nodesData = [],
  title,
  description,
}: {
  data: DailyPoint[];
  nodesData?: DailyPoint[];
  title?: string;
  description?: string;
}) {
  const allDates = useMemo(() => {
    const set = new Set([...data.map((d) => d.date), ...nodesData.map((d) => d.date)]);
    return Array.from(set).sort();
  }, [data, nodesData]);

  const wfMap = useMemo(() => Object.fromEntries(data.map((d) => [d.date, d])), [data]);
  const nodeMap = useMemo(() => Object.fromEntries(nodesData.map((d) => [d.date, d])), [nodesData]);

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
          { name: "WF errors", itemStyle: { color: COLORS.wfFailed } },
          { name: "Node errors", itemStyle: { color: COLORS.nodeFailed } },
          { name: "WF error rate %", itemStyle: { color: COLORS.rate } },
        ],
      },
      xAxis: {
        type: "category",
        data: allDates,
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
          name: "WF errors",
          type: "bar",
          data: allDates.map((d) => wfMap[d]?.failed ?? 0),
          itemStyle: { color: COLORS.wfFailed, opacity: 0.85 },
        },
        {
          name: "Node errors",
          type: "bar",
          data: allDates.map((d) => nodeMap[d]?.failed ?? 0),
          itemStyle: { color: COLORS.nodeFailed, opacity: 0.85 },
        },
        {
          name: "WF error rate %",
          type: "line",
          yAxisIndex: 1,
          smooth: true,
          symbol: "none",
          data: allDates.map((d) => {
            const p = wfMap[d];
            if (!p?.total) return 0;
            return Number(((p.failed / p.total) * 100).toFixed(2));
          }),
          lineStyle: { color: COLORS.rate, opacity: 0.95 },
          itemStyle: { color: COLORS.rate },
        },
      ],
    }),
    [allDates, wfMap, nodeMap],
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
