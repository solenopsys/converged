import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { DashboardLayout, HeaderPanelLayout, ScrollArea, StatisticCard } from "front-core";
import { Clock, History, RefreshCw, Activity } from "lucide-react";
import { $stats, statsViewMounted, refreshStatsClicked } from "../domain-stats";
import { CronStatusPieChart } from "../components/CronStatusPieChart";
import { CronRunsLineChart } from "../components/CronRunsLineChart";

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
      <ScrollArea className="h-full">
        <DashboardLayout>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatisticCard
              title="Crons"
              value={stats.crons}
              icon={Clock}
              description="Scheduled tasks"
            />
            <StatisticCard
              title="Active crons"
              value={stats.activeCrons}
              icon={Activity}
              description="Enabled"
            />
            <StatisticCard
              title="History"
              value={stats.history}
              icon={History}
              description="Fired events"
            />
            <StatisticCard
              title="Active rate %"
              value={stats.crons ? Number(((Number(stats.activeCrons ?? 0) / Number(stats.crons ?? 0)) * 100).toFixed(2)) : 0}
              icon={Clock}
              description="Share of active crons"
            />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="h-[280px]">
              <CronRunsLineChart data={stats.dailyRuns ?? []} />
            </div>
            <CronStatusPieChart
              active={Number(stats.activeCrons ?? 0)}
              paused={Number(stats.pausedCrons ?? 0)}
            />
          </div>
        </DashboardLayout>
      </ScrollArea>
    </HeaderPanelLayout>
  );
};

export default StatsView;
