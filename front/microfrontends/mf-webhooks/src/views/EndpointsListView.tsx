import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanel, InfiniteScrollDataTable } from "front-core";
import { RefreshCw, Plus } from "lucide-react";
import {
  $endpointsStore,
  endpointsViewMounted,
  refreshEndpointsClicked,
  addEndpointClicked,
  openEndpointForm,
} from "../domain-endpoints";
import { endpointColumns } from "../functions/columns";
import { createEndpointFormWidget } from "../functions/endpoints.config";

export const EndpointsListView = ({ bus }) => {
  const endpointsState = useUnit($endpointsStore.$state);

  useEffect(() => {
    endpointsViewMounted();

    const unwatch = addEndpointClicked.watch(() => {
      openEndpointForm({ endpoint: null });
      bus.present({ widget: createEndpointFormWidget(bus) });
    });

    return () => unwatch();
  }, [bus]);

  const headerConfig = {
    title: "Webhooks",
    actions: [
      {
        id: "add",
        label: "Add Endpoint",
        icon: Plus,
        event: addEndpointClicked,
        variant: "default" as const,
      },
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshEndpointsClicked,
        variant: "outline" as const,
      },
    ],
  };

  const handleRowClick = (row) => {
    openEndpointForm({ endpoint: row });
    bus.present({ widget: createEndpointFormWidget(bus) });
  };

  return (
    <div className="flex flex-col h-full">
      <HeaderPanel config={headerConfig} />
      <div className="flex-1 overflow-hidden p-4">
        <InfiniteScrollDataTable
          data={endpointsState.items}
          hasMore={endpointsState.hasMore}
          loading={endpointsState.loading}
          columns={endpointColumns}
          onLoadMore={$endpointsStore.loadMore}
          onRowClick={handleRowClick}
          viewMode="table"
        />
      </div>
    </div>
  );
};

export default EndpointsListView;
