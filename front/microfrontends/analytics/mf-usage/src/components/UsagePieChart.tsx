import { useMemo } from "react"
import ReactECharts from "echarts-for-react"
import { Card, CardContent, CardDescription, CardHeader } from "front-core"

interface UsageFunctionStatsItem { function: string; total: number }
interface UsagePieChartProps { data: UsageFunctionStatsItem[]; title?: string }

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"]

export function UsagePieChart({ data = [], title }: UsagePieChartProps) {
  const chartData = useMemo(
    () =>
      data
        .filter((item) => item.total > 0)
        .sort((a, b) => b.total - a.total)
        .map((item, index) => ({
          ...item,
          fill: COLORS[index % COLORS.length],
        })),
    [data],
  )

  const option = useMemo(() => ({
    tooltip: {
      trigger: "item",
      formatter: (p: any) =>
        `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color};margin-right:4px"></span>${p.name}: <b>${p.value.toLocaleString()}</b>`,
    },
    series: [{
      type: "pie",
      radius: ["60px", "92px"],
      data: chartData.map((d) => ({ name: d.function, value: d.total, itemStyle: { color: d.fill } })),
      label: { show: false },
      emphasis: { label: { show: false } },
      itemStyle: { borderWidth: 2, borderColor: "transparent" },
    }],
  }), [chartData])

  if (chartData.length === 0) {
    return (
      <Card className="flex h-[360px] flex-col gap-4 py-4">
        <CardHeader className="px-4 pb-2">
          {title && <CardDescription>{title}</CardDescription>}
        </CardHeader>
        <div className="flex flex-1 items-center justify-center px-4 pb-4 pt-0 text-sm text-muted-foreground">
          No data
        </div>
      </Card>
    )
  }

  return (
    <Card className="flex h-[360px] flex-col gap-4 py-4">
      {title && (
        <CardHeader className="shrink-0 px-4 pb-2">
          <CardDescription>{title}</CardDescription>
        </CardHeader>
      )}
      <CardContent className="flex min-h-0 flex-1 px-4 pb-4 pt-0">
        <div className="h-full min-h-[220px] w-full overflow-hidden">
          <ReactECharts option={option} style={{ height: "100%", width: "100%" }} />
        </div>
      </CardContent>
      <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 pb-4 text-xs">
        {chartData.map((item) => (
          <div key={item.function} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.fill }} />
            <span>{item.function}</span>
            <span className="font-mono text-foreground">{item.total.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
