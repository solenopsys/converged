import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanelLayout, ScrollArea, StatisticCard } from "front-core";
import { Database, RefreshCw } from "lucide-react";
import { $telemetryStats, telemetryStatsViewMounted, refreshTelemetryStatsClicked } from "../domain-stats";

export const TelemetryStatsView = ({ bus }: { bus: any }) => {
  const stats = useUnit($telemetryStats);

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
      </ScrollArea>
    </HeaderPanelLayout>
  );
};
