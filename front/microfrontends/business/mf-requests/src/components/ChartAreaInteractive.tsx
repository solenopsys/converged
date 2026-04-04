"use client"

import * as React from "react"
import { useMemo } from "react"
import ReactECharts from "echarts-for-react"
import { useGlobalTranslation, useIsMobile, Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, ToggleGroup, ToggleGroupItem } from "front-core"

type ChartAreaPoint = {
  date: string
  requests: number
  orders: number
  conversion: number
}

interface ChartAreaInteractiveProps {
  data?: ChartAreaPoint[]
}

export function ChartAreaInteractive({ data = [] }: ChartAreaInteractiveProps) {
  const { t, i18n } = useGlobalTranslation("chart")
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("90d")

  const chartData = useMemo(() => {
    if (!Array.isArray(data)) return []
    return data.filter((item) => item && typeof item === "object" && !!item.date)
  }, [data])

  React.useEffect(() => {
    if (isMobile) setTimeRange("7d")
  }, [isMobile])

  const filteredData = useMemo(() => {
    if (chartData.length === 0) return []

    const validDates = chartData
      .map((item: any) => new Date(item.date))
      .filter((date) => !Number.isNaN(date.getTime()))

    if (validDates.length === 0) return []

    const referenceDate = new Date(Math.max(...validDates.map((date) => date.getTime())))
    const daysToSubtract = timeRange === "30d" ? 30 : timeRange === "7d" ? 7 : 90
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    return chartData.filter((item: any) => {
      if (!item || typeof item !== "object" || !item.date) return false
      return new Date(item.date) >= startDate
    })
  }, [chartData, timeRange])

  const locale = (i18n.language || "en") === "ru" ? "ru-RU" : "en-US"

  const option = useMemo(() => {
    const dates = filteredData.map((d: any) => d.date)
    return {
      grid: { top: 8, right: 48, left: 48, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: dates,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          interval: Math.max(0, Math.floor(dates.length / 6) - 1),
          formatter: (value: string) => new Date(value).toLocaleDateString(locale, { month: "short", day: "numeric" }),
        },
      },
      yAxis: [
        { type: "value", position: "left", axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: "rgba(128,128,128,0.15)" } } },
        { type: "value", position: "right", axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { formatter: (v: number) => `${v}%` } },
      ],
      tooltip: {
        trigger: "axis",
        formatter: (params: any[]) => {
          const date = new Date(params[0].axisValue).toLocaleDateString(locale, { month: "short", day: "numeric" })
          const rows = params.map((p) => `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color};margin-right:4px"></span>${p.seriesName}: <b>${p.value}</b>`).join("<br/>")
          return `<div style="font-size:12px"><b>${date}</b><br/>${rows}</div>`
        },
      },
      series: [
        {
          name: t("chart_config.requests.label"),
          type: "line", yAxisIndex: 0,
          data: filteredData.map((d: any) => d.requests),
          smooth: true, symbol: "none",
          lineStyle: { color: "#6366f1", opacity: 0.85 }, itemStyle: { color: "#6366f1" },
          areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0.05, color: "rgba(99,102,241,0.8)" }, { offset: 0.95, color: "rgba(99,102,241,0.1)" }] } },
        },
        {
          name: t("chart_config.orders.label"),
          type: "line", yAxisIndex: 0,
          data: filteredData.map((d: any) => d.orders),
          smooth: true, symbol: "none",
          lineStyle: { color: "#6366f1", opacity: 0.6 }, itemStyle: { color: "#6366f1" },
          areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0.05, color: "rgba(99,102,241,0.6)" }, { offset: 0.95, color: "rgba(99,102,241,0.05)" }] } },
        },
        {
          name: t("chart_config.conversion.label"),
          type: "line", yAxisIndex: 1,
          data: filteredData.map((d: any) => d.conversion),
          smooth: true, symbol: "none",
          lineStyle: { color: "#f59e0b", opacity: 0.85 }, itemStyle: { color: "#f59e0b" },
          areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0.05, color: "rgba(245,158,11,0.5)" }, { offset: 0.95, color: "rgba(245,158,11,0.05)" }] } },
        },
      ],
    }
  }, [filteredData, locale, t])

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">{t("description")}</span>
          <span className="@[540px]/card:hidden">{t("description_short")}</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup type="single" value={timeRange} onValueChange={(value) => value && setTimeRange(value)} variant="outline" className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex">
            <ToggleGroupItem value="90d">{t("time_ranges.90d")}</ToggleGroupItem>
            <ToggleGroupItem value="30d">{t("time_ranges.30d")}</ToggleGroupItem>
            <ToggleGroupItem value="7d">{t("time_ranges.7d")}</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden" size="sm" aria-label="Select a value">
              <SelectValue placeholder={t("time_ranges.90d")} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">{t("time_ranges.90d")}</SelectItem>
              <SelectItem value="30d" className="rounded-lg">{t("time_ranges.30d")}</SelectItem>
              <SelectItem value="7d" className="rounded-lg">{t("time_ranges.7d")}</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-2">
        <div className="h-[250px] w-full">
          {filteredData.length > 0 ? (
            <ReactECharts option={option} style={{ height: "100%", width: "100%" }} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              No data yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
