import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanelLayout, InfiniteScrollDataTable } from "front-core";
import { Plus, RefreshCw } from "lucide-react";
import {
  $sessionsStore,
  sessionsListMounted,
  refreshSessionsClicked,
  createSessionClicked,
  openSessionDetail,
} from "../domain-sessions";
import { sessionsColumns } from "../config";

export const SessionsListView = ({ bus }) => {
  const sessionsState = useUnit($sessionsStore.$state);

  useEffect(() => {
    sessionsListMounted();
  }, []);

  const headerConfig = {
    title: "Sessions",
    actions: [
      {
        id: "create",
        label: "New Session",
        icon: Plus,
        event: createSessionClicked,
        variant: "default" as const,
      },
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshSessionsClicked,
        variant: "outline" as const,
      },
    ],
  };

  const handleRowClick = (row) => {
    const recordId = row.id;
    if (!recordId) return;
    openSessionDetail({ recordId });
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
      <InfiniteScrollDataTable
        data={sessionsState.items}
        hasMore={sessionsState.hasMore}
        loading={sessionsState.loading}
        columns={sessionsColumns}
        onRowClick={handleRowClick}
        onLoadMore={$sessionsStore.loadMore}
        viewMode="table"
      />
    </HeaderPanelLayout>
  );
};
