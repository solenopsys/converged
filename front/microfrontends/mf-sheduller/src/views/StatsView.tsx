import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanel, ScrollArea, StatisticCard } from "front-core";
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
    <div className="flex flex-col h-full">
      <HeaderPanel config={headerConfig} />
      <div className="flex-1 overflow-hidden p-4">
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
      </div>
    </div>
  );
};

export default StatsView;
