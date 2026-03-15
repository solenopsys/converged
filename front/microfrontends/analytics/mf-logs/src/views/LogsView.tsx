import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import {
  HeaderPanelLayout,
  InfiniteScrollDataTable,
  useMicrofrontendTranslation,
} from "front-core";
import { RefreshCw } from "lucide-react";
import { $logsHotStore, $logsColdStore, logsViewMounted, refreshLogsClicked, type LogsMode } from "../domain-logs";
import { logsColumns } from "../functions/columns";

const LOGS_MF_ID = "logs-mf";

export const LogsView = ({ mode = "hot" }: { mode?: LogsMode }) => {
  const $store = mode === "hot" ? $logsHotStore : $logsColdStore;
  const logsState = useUnit($store.$state);
  const { t } = useMicrofrontendTranslation(LOGS_MF_ID);

  useEffect(() => {
    logsViewMounted(mode);
  }, [mode]);

  const headerConfig = {
    title: mode === "hot" ? t("logs.view.hotTitle") : t("logs.view.coldTitle"),
    actions: [
      {
        id: "refresh",
        label: t("logs.view.refresh"),
        icon: RefreshCw,
        event: refreshLogsClicked,
        variant: "outline" as const,
      },
    ],
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
        <InfiniteScrollDataTable
          data={logsState.items}
          hasMore={logsState.hasMore}
          loading={logsState.loading}
          columns={logsColumns}
          onLoadMore={$store.loadMore}
          viewMode="table"
        />
    </HeaderPanelLayout>
  );
};
