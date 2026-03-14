import { useMemo } from "react"
import ReactECharts from "echarts-for-react"
import { Card, CardContent, CardDescription, CardHeader } from "front-core"

interface UsageFunctionStatsItem { function: string; total: number }
interface UsagePieChartProps { data: UsageFunctionStatsItem[]; title?: string }

export function UsagePieChart({ data = [], title }: UsagePieChartProps) {
  const option = useMemo(() => ({
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { orient: "vertical", right: 10, top: "center", type: "scroll", textStyle: { fontSize: 11 } },
    series: [{
      type: "pie",
      radius: ["40%", "70%"],
      center: ["35%", "50%"],
      data: data.map((d) => ({ name: d.function, value: d.total })),
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 13, fontWeight: "bold" } },
    }],
  }), [data])

  return (
    <Card className="flex h-full flex-col gap-4 py-4">
      {title && (
        <CardHeader className="shrink-0 px-4 pb-2">
          <CardDescription>{title}</CardDescription>
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
