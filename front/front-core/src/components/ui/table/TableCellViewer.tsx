// file: src/components/TableCellViewer.tsx
import React from "react"
import ReactECharts from "echarts-for-react"
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "../drawer"
import { Button } from "../button"
import { useIsMobile } from "../../../hooks/use-mobile"
import { Separator } from "../separator"
import { IconTrendingUp } from "../../../icons-shim"
import { chartData, type Order } from "./types"
import { useTranslation } from "react-i18next"

interface TableCellViewerProps { item: Order }

const COLORS = { mobile: "#3b82f6", desktop: "#8b5cf6" }

// option статичен — выносим за пределы компонента, создаётся один раз
const chartOption = {
  grid: { top: 4, right: 10, left: 0, bottom: 0, containLabel: true },
  xAxis: { type: "category", data: chartData.map((d) => d.month), show: false },
  yAxis: { type: "value", axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: "rgba(128,128,128,0.15)" } } },
  tooltip: {
    trigger: "axis",
    formatter: (params: any[]) => {
      const rows = params.map((p) => `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color};margin-right:4px"></span>${p.seriesName}: <b>${p.value}</b>`).join("<br/>")
      return `<div style="font-size:12px">${rows}</div>`
    },
  },
  series: [
    { name: "Mobile", type: "line", stack: "total", data: chartData.map((d) => d.mobile), smooth: true, symbol: "none", lineStyle: { color: COLORS.mobile }, itemStyle: { color: COLORS.mobile }, areaStyle: { color: COLORS.mobile, opacity: 0.6 } },
    { name: "Desktop", type: "line", stack: "total", data: chartData.map((d) => d.desktop), smooth: true, symbol: "none", lineStyle: { color: COLORS.desktop }, itemStyle: { color: COLORS.desktop }, areaStyle: { color: COLORS.desktop, opacity: 0.4 } },
  ],
}

export const TableCellViewer: React.FC<TableCellViewerProps> = ({ item }) => {
  const isMobile = useIsMobile()
  const { t } = useTranslation("table_titles")

  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      <DrawerTrigger asChild>
        <Button variant="link" className="w-fit px-0 text-left text-foreground">{item.model_name}</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <DrawerTitle>{item.model_name}</DrawerTitle>
          <DrawerDescription>{t("drawer.description")}</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          {!isMobile && (
            <>
              <div className="h-[200px] w-full">
                <ReactECharts option={chartOption} style={{ height: "100%", width: "100%" }} />
              </div>
              <Separator />
              <div className="grid gap-2">
                <p className="flex items-center gap-2 font-medium leading-none">
                  {t("drawer.trending_text")} <IconTrendingUp className="size-4" />
                </p>
                <p className="text-muted-foreground">{t("drawer.chart_description")}</p>
              </div>
              <Separator />
            </>
          )}
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2"><span className="text-muted-foreground">{t("columns.printing_type")}:</span><span>{item.printing_type}</span></div>
            <div className="grid grid-cols-2 gap-2"><span className="text-muted-foreground">{t("columns.status")}:</span><span>{item.status}</span></div>
            <div className="grid grid-cols-2 gap-2"><span className="text-muted-foreground">{t("columns.quantity")}:</span><span>{item.quantity}</span></div>
            <div className="grid grid-cols-2 gap-2"><span className="text-muted-foreground">{t("columns.weight_per_item")}:</span><span>{item.weight_per_item}</span></div>
            <div className="grid grid-cols-2 gap-2"><span className="text-muted-foreground">{t("columns.material")}:</span><span>{item.material}</span></div>
          </div>
        </div>
        <DrawerFooter>
          <Button>{t("actions.edit")}</Button>
          <DrawerClose asChild><Button variant="outline">{t("drawer.close")}</Button></DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
