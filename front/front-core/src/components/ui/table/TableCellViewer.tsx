// file: src/components/TableCellViewer.tsx
import React from "react";
import { 
  Drawer, 
  DrawerTrigger, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription, 
  DrawerFooter, 
  DrawerClose 
} from "../drawer";
import { Button } from "../button";
import { useIsMobile } from "../../../hooks/use-mobile";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../chart";
import { AreaChart, Area, CartesianGrid, XAxis } from "recharts";
import { Separator } from "../separator";
import { IconTrendingUp } from "@tabler/icons-react";
import { chartConfig, chartData, type Order } from "./types";
import { useTranslation } from "react-i18next";

interface TableCellViewerProps {
  item: Order;
}

export const TableCellViewer: React.FC<TableCellViewerProps> = ({ item }) => {
  const isMobile = useIsMobile();
  const { t } = useTranslation("table_titles");

  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      <DrawerTrigger asChild>
        <Button variant="link" className="w-fit px-0 text-left text-foreground">
          {item.model_name}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <DrawerTitle>{item.model_name}</DrawerTitle>
          <DrawerDescription>{t("drawer.description")}</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          {!isMobile && (
            <>
              <ChartContainer config={chartConfig}>
                <AreaChart data={chartData} margin={{ left: 0, right: 10 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" hide tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                  <Area 
                    dataKey="mobile" 
                    type="natural" 
                    fill="var(--color-mobile)" 
                    fillOpacity={0.6} 
                    stroke="var(--color-mobile)" 
                    stackId="a" 
                  />
                  <Area 
                    dataKey="desktop" 
                    type="natural" 
                    fill="var(--color-desktop)" 
                    fillOpacity={0.4} 
                    stroke="var(--color-desktop)" 
                    stackId="a" 
                  />
                </AreaChart>
              </ChartContainer>
              <Separator />
              <div className="grid gap-2">
                <p className="flex items-center gap-2 font-medium leading-none">
                  {t("drawer.trending_text")} <IconTrendingUp className="size-4" />
                </p>
                <p className="text-muted-foreground">
                  {t("drawer.chart_description")}
                </p>
              </div>
              <Separator />
            </>
          )}
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">{t("columns.printing_type")}:</span>
              <span>{item.printing_type}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">{t("columns.status")}:</span>
              <span>{item.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">{t("columns.quantity")}:</span>
              <span>{item.quantity}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">{t("columns.weight_per_item")}:</span>
              <span>{item.weight_per_item}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">{t("columns.material")}:</span>
              <span>{item.material}</span>
            </div>
          </div>
        </div>
        <DrawerFooter>
          <Button>{t("actions.edit")}</Button>
          <DrawerClose asChild>
            <Button variant="outline">{t("drawer.close")}</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};