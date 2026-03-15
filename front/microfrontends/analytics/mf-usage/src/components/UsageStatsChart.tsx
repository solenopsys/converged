import { useMemo } from "react"
import ReactECharts from "echarts-for-react"
import { Card, CardContent, CardDescription, CardHeader } from "front-core"

interface UsageDailyStatsItem { date: string; total: number }
interface UsageStatsChartProps { data: UsageDailyStatsItem[]; title?: string; description?: string }

const COLOR = "#3b82f6"

export function UsageStatsChart({ data = [], title, description }: UsageStatsChartProps) {
  const option = useMemo(() => ({
    grid: { top: 36, right: 12, left: 0, bottom: 20, containLabel: true },
    legend: {
      top: 4,
      right: 0,
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { fontSize: 12 },
      data: [{ name: "Usage", itemStyle: { color: COLOR } }],
    },
    xAxis: { type: "category", data: data.map((d) => d.date), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { formatter: (v: string) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" }) } },
    yAxis: { type: "value", axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: "rgba(128,128,128,0.15)" } } },
    tooltip: { trigger: "axis" },
    series: [{ name: "Usage", type: "line", data: data.map((d) => d.total), smooth: true, symbol: "none", lineStyle: { color: COLOR, opacity: 0.85 }, itemStyle: { color: COLOR }, areaStyle: { color: COLOR, opacity: 0.3 } }],
  }), [data])

  return (
    <Card className="flex h-full flex-col gap-4 py-4">
      {(title || description) && (
        <CardHeader className="shrink-0 px-4 pb-2">
          {title && <CardDescription>{title}</CardDescription>}
          {description && <div className="text-xs text-muted-foreground">{description}</div>}
        </CardHeader>
      )}
      <CardContent className="flex min-h-0 flex-1 px-4 pb-4 pt-0">
        <div className="flex-1 min-h-[160px] w-full overflow-hidden">
          <ReactECharts option={option} style={{ height: "100%", width: "100%" }} />
        </div>
      </CardContent>
    </Card>
  )
}
