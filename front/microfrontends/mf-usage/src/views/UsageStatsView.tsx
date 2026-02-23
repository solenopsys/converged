import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanel, Card, CardContent, CardHeader, CardTitle } from "front-core";
import { RefreshCw } from "lucide-react";
import {
  $dailyStats,
  $totalStats,
  usageStatsViewMounted,
  refreshUsageStatsClicked,
} from "../domain-stats";
import { UsageStatsChart } from "../components/UsageStatsChart";

export const UsageStatsView = () => {
  const dailyStats = useUnit($dailyStats);
  const totalStats = useUnit($totalStats);

  useEffect(() => {
    usageStatsViewMounted({});
  }, []);

  const headerConfig = {
    title: "Usage Statistics",
    actions: [
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshUsageStatsClicked,
        variant: "outline" as const,
      },
    ],
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <HeaderPanel config={headerConfig} />
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Total usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{totalStats}</div>
              <div className="text-sm text-muted-foreground">All time</div>
            </CardContent>
          </Card>
          <div className="md:col-span-2 min-h-[260px]">
            <UsageStatsChart
              data={dailyStats}
              title="Daily usage"
              description="Usage counts by day"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsageStatsView;
