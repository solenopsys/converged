import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanel, InfiniteScrollDataTable } from "front-core";
import { RefreshCw } from "lucide-react";
import type { LogsMode } from "../domain-logs";
import { $logsStore, logsViewMounted, refreshLogsClicked } from "../domain-logs";
import { logsColumns } from "../functions/columns";

interface LogsViewProps {
  mode?: LogsMode;
}

export const LogsView = ({ mode = "hot" }: LogsViewProps) => {
  const logsState = useUnit($logsStore.$state);

  useEffect(() => {
    logsViewMounted({ mode });
  }, [mode]);

  const headerConfig = {
    title: "Logs",
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
    <div className="flex flex-col h-full">
      <HeaderPanel config={headerConfig} />
      <div className="flex-1 overflow-hidden p-4">
        <InfiniteScrollDataTable
          data={logsState.items}
          hasMore={logsState.hasMore}
          loading={logsState.loading}
          columns={logsColumns}
          onLoadMore={$logsStore.loadMore}
          viewMode="table"
        />
      </div>
    </div>
  );
};
