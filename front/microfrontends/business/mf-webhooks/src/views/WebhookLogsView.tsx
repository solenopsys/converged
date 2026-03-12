import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanelLayout, InfiniteScrollDataTable } from "front-core";
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
    <HeaderPanelLayout config={headerConfig}>
        <InfiniteScrollDataTable
          data={logsState.items}
          hasMore={logsState.hasMore}
          loading={logsState.loading}
          columns={logColumns}
          onLoadMore={$logsStore.loadMore}
          viewMode="table"
        />
    </HeaderPanelLayout>
  );
};

export default WebhookLogsView;
