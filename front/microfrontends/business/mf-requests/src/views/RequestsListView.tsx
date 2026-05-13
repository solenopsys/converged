import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanelLayout, InfiniteScrollDataTable } from "front-core";
import { RefreshCw } from "lucide-react";
import { $requestsStore, requestsListMounted, refreshRequestsClicked, openRequestDetail } from "../domain-requests";
import { requestsColumns } from "../config";

export const RequestsListView = ({ bus }: { bus: any }) => {
  const state = useUnit($requestsStore.$state);

  useEffect(() => {
    requestsListMounted();
  }, []);

  const headerConfig = {
    title: "Заявки",
    actions: [
      {
        id: "refresh",
        label: "Обновить",
        icon: RefreshCw,
        event: refreshRequestsClicked,
        variant: "outline" as const,
      },
    ],
  };

  const handleRowClick = (row: any) => {
    if (row?.id) openRequestDetail({ recordId: row.id });
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
      <InfiniteScrollDataTable
        data={state.items}
        hasMore={state.hasMore}
        loading={state.loading}
        columns={requestsColumns}
        onRowClick={handleRowClick}
        onLoadMore={$requestsStore.loadMore}
        viewMode="table"
      />
    </HeaderPanelLayout>
  );
};
