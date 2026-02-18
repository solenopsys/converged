"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useGlobalTranslation } from "../hooks/global_i18n";

import { useIsMobile } from "../hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "./ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "./ui/toggle-group"

export function ChartAreaInteractive() {
  const { t, i18n } = useGlobalTranslation("chart")
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("90d")

  // Get chart data from i18n resources
  const chartData = i18n.getResource(i18n.language, 'chart_data') || []


  // Create chart config from translation
  const chartConfig = {
    visitors: {
      label: t("chart_config.visitors.label"),
      color: "var(--primary)",
    },
    requests: {
      label: t("chart_config.requests.label"),
      color: "var(--primary)",
    },
    orders: {
      label: t("chart_config.orders.label"),
      color: "var(--primary)",
    },
    conversion: {
      label: t("chart_config.conversion.label"),
      color: "var(--accent)",
    },
  } as ChartConfig

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  const filteredData = chartData.filter((item) => {
    const date = new Date(item.date)
    const referenceDate = new Date("2024-06-30")
    let daysToSubtract = 90
    if (timeRange === "30d") {
      daysToSubtract = 30
    } else if (timeRange === "7d") {
      daysToSubtract = 7
    }
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    return date >= startDate
  })

  // Get the current language for date formatting
  const currentLang = i18n.language || 'en'

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {t("description")}
          </span>
          <span className="@[540px]/card:hidden">{t("description_short")}</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">{t("time_ranges.90d")}</ToggleGroupItem>
            <ToggleGroupItem value="30d">{t("time_ranges.30d")}</ToggleGroupItem>
            <ToggleGroupItem value="7d">{t("time_ranges.7d")}</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder={t("time_ranges.90d")} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                {t("time_ranges.90d")}
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                {t("time_ranges.30d")}
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                {t("time_ranges.7d")}
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-2">
        <ChartContainer
          config={chartConfig}
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillRequests" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-requests)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-requests)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillOrders" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-orders)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-orders)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillConversion" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-conversion)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-conversion)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US', {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <YAxis
              yAxisId="left"
              orientation="left"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
            />
            <ChartTooltip
              cursor={false}
              defaultIndex={isMobile ? -1 : 10}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US', {
                      month: "short",
                      day: "numeric",
                    })
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="requests"
              yAxisId="left"
              type="natural"
              fill="url(#fillRequests)"
              stroke="var(--color-requests)"
            />
            <Area
              dataKey="orders"
              yAxisId="left"
              type="natural"
              fill="url(#fillOrders)"
              stroke="var(--color-orders)"
            />
            <Area
              dataKey="conversion"
              yAxisId="right"
              type="natural"
              fill="url(#fillConversion)"
              stroke="var(--color-conversion)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
