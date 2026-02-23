import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import {
  HeaderPanelLayout,
  ScrollArea,
  StatisticCard,
  useMicrofrontendTranslation,
} from "front-core";
import { Database, Archive, AlertTriangle, AlertCircle, RefreshCw } from "lucide-react";
import { $logsStats, logsStatsViewMounted, refreshLogsStatsClicked } from "../domain-stats";

const LOGS_MF_ID = "logs-mf";

export const LogsStatsView = ({ bus }: { bus: any }) => {
  const stats = useUnit($logsStats);
  const { t } = useMicrofrontendTranslation(LOGS_MF_ID);

  useEffect(() => {
    logsStatsViewMounted();
  }, []);

  const headerConfig = {
    title: t("logs.stats.title"),
    actions: [
      {
        id: "refresh",
        label: t("logs.stats.refresh"),
        icon: RefreshCw,
        event: refreshLogsStatsClicked,
        variant: "outline" as const,
      },
    ],
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
        <ScrollArea className="h-full pr-2">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatisticCard
              title={t("logs.stats.totalHot")}
              value={stats.totalHot}
              icon={Database}
              description={t("logs.stats.hotDescription")}
            />
            <StatisticCard
              title={t("logs.stats.totalCold")}
              value={stats.totalCold}
              icon={Archive}
              description={t("logs.stats.coldDescription")}
            />
            <StatisticCard
              title={t("logs.stats.errors")}
              value={stats.errors}
              icon={AlertCircle}
              description={t("logs.stats.errorsDescription")}
            />
            <StatisticCard
              title={t("logs.stats.warnings")}
              value={stats.warnings}
              icon={AlertTriangle}
              description={t("logs.stats.warningsDescription")}
            />
          </div>
        </ScrollArea>
    </HeaderPanelLayout>
  );
};
