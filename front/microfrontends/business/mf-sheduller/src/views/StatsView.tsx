import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanelLayout, ScrollArea, StatisticCard } from "front-core";
import { Clock, History, RefreshCw } from "lucide-react";
import { $stats, statsViewMounted, refreshStatsClicked } from "../domain-stats";

export const StatsView = () => {
  const stats = useUnit($stats);

  useEffect(() => {
    statsViewMounted();
  }, []);

  const headerConfig = {
    title: "Sheduller",
    actions: [
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshStatsClicked,
        variant: "outline" as const,
      },
    ],
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
        <ScrollArea className="h-full pr-2">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StatisticCard
              title="Crons"
              value={stats.crons}
              icon={Clock}
              description="Scheduled tasks"
            />
            <StatisticCard
              title="History"
              value={stats.history}
              icon={History}
              description="Fired events"
            />
          </div>
        </ScrollArea>
    </HeaderPanelLayout>
  );
};

export default StatsView;
