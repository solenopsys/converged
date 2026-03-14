import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanelLayout, InfiniteScrollDataTable } from "front-core";
import { RefreshCw } from "lucide-react";
import { $logsHotStore, $logsColdStore, logsViewMounted, refreshLogsClicked, type LogsMode } from "../domain-logs";
import { logsColumns } from "../functions/columns";

export const LogsView = ({ mode = "hot" }: { mode?: LogsMode }) => {
  const $store = mode === "hot" ? $logsHotStore : $logsColdStore;
  const logsState = useUnit($store.$state);

  useEffect(() => {
    logsViewMounted(mode);
  }, [mode]);

  const headerConfig = {
    title: mode === "hot" ? "Logs (Hot)" : "Logs (Cold)",
    actions: [
      {
        id: "refresh",
        label: "Refresh",
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
