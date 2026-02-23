import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import {
  HeaderPanelLayout,
  ScrollArea,
  StatisticCard,
} from "front-core";
import { Play, CheckCircle, XCircle, BarChart3, RefreshCw } from "lucide-react";
import { $dagStats, statsViewMounted, refreshStatsClicked } from "../domain-stats";

const ICONS = {
  total: BarChart3,
  running: Play,
  done: CheckCircle,
  failed: XCircle,
};

export const StatsView = ({ bus }) => {
  const stats = useUnit($dagStats);

  useEffect(() => {
    statsViewMounted();
  }, []);

  const headerConfig = {
    title: "DAG Statistics",
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

  const statItems = [
    { key: "total", label: "Total", icon: ICONS.total },
    { key: "running", label: "Running", icon: ICONS.running },
    { key: "done", label: "Done", icon: ICONS.done },
    { key: "failed", label: "Failed", icon: ICONS.failed },
  ];

  return (
    <HeaderPanelLayout config={headerConfig}>
        <ScrollArea className="h-full pr-2">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statItems.map(({ key, label, icon: Icon }) => (
              <StatisticCard
                key={key}
                title={label}
                value={stats[key] ?? 0}
                icon={Icon}
                description="contexts"
              />
            ))}
          </div>
        </ScrollArea>
    </HeaderPanelLayout>
  );
};
