import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanel, InfiniteScrollDataTable } from "front-core";
import { RefreshCw } from "lucide-react";
import { $logsStore, logsViewMounted, refreshLogsClicked } from "../domain-logs";
import { logColumns } from "../functions/columns";

export const WebhookLogsView = ({ endpointId }) => {
  const logsState = useUnit($logsStore.$state);

  useEffect(() => {
    logsViewMounted({ endpointId });
  }, [endpointId]);

  const headerConfig = {
    title: "Webhook Logs",
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
          columns={logColumns}
          onLoadMore={$logsStore.loadMore}
          viewMode="table"
        />
      </div>
    </div>
  );
};

export default WebhookLogsView;
