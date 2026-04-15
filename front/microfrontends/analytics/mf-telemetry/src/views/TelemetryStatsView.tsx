import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanelLayout, ScrollArea, StatisticCard } from "front-core";
import { Database, RefreshCw } from "lucide-react";
import {
  $telemetryHotChartEvents,
  $telemetryStats,
  telemetryStatsViewMounted,
  refreshTelemetryStatsClicked,
} from "../domain-stats";
import { TelemetryDeviceParamPieChart } from "../components/TelemetryDeviceParamPieChart";
import { TelemetryScatterChart } from "../components/TelemetryScatterChart";

export const TelemetryStatsView = ({ bus }: { bus: any }) => {
  const stats = useUnit($telemetryStats);
  const hotChartEvents = useUnit($telemetryHotChartEvents);

  useEffect(() => {
    telemetryStatsViewMounted();
  }, []);

  const headerConfig = {
    title: "Telemetry Statistics",
    actions: [
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshTelemetryStatsClicked,
        variant: "outline" as const,
      },
    ],
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
      <ScrollArea className="h-full">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatisticCard
              title="Hot Storage"
              value={stats.totalHot}
              icon={Database}
              description="Events in operational storage"
            />
            <StatisticCard
              title="Cold Storage"
              value={stats.totalCold}
              icon={Database}
              description="Events in long-term storage"
            />
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
            <TelemetryScatterChart data={hotChartEvents} />
            <TelemetryDeviceParamPieChart data={hotChartEvents} />
          </div>
        </div>
      </ScrollArea>
    </HeaderPanelLayout>
  );
};
