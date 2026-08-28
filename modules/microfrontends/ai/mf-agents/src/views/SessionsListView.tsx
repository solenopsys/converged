import React, { useEffect } from "preact/compat";
import { useUnit } from "effector-preact";
import { HeaderPanelLayout, InfiniteScrollDataTable, useMicrofrontendTranslation } from "front-core";
import { Plus, RefreshCw } from "front-core";
import {
  $sessionsStore,
  sessionsListMounted,
  refreshSessionsClicked,
  createSessionClicked,
  openSessionDetail,
} from "../domain-sessions";
import { sessionsColumns } from "../config";

const MF_ID = "agents-mf";

export const SessionsListView = ({ bus }) => {
  const sessionsState = useUnit($sessionsStore.$state);
  const { t } = useMicrofrontendTranslation(MF_ID);

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
        columns={sessionsColumns(t)}
        onRowClick={handleRowClick}
        onLoadMore={$sessionsStore.loadMore}
        viewMode="table"
      />
    </HeaderPanelLayout>
  );
};
