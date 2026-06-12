import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import {
  HeaderPanelLayout,
  InfiniteScrollDataTable,
  upsertSidebarTab,
} from "front-core";
import { RefreshCw } from "lucide-react";
import {
  $contextsStore,
  contextsViewMounted,
  refreshContextsClicked,
} from "../domain-contexts";
import { callContextsColumns, type CallContextRow } from "../config";
import { ContextJsonView } from "./ContextJsonView";

const CONTEXT_JSON_TAB_ID = "call-context-json";

type ContextsListViewProps = {
  bus?: any;
};

const createContextJsonWidget = (_bus: any, params: { name: string }) => ({
  view: ContextJsonView,
  placement: () => `sidebar:tab:${CONTEXT_JSON_TAB_ID}`,
  config: params,
  commands: {},
});

export const ContextsListView: React.FC<ContextsListViewProps> = ({ bus }) => {
  const contextsState = useUnit($contextsStore.$state);

  useEffect(() => {
    contextsViewMounted();
  }, []);

  const headerConfig = {
    title: "Call Contexts",
    actions: [
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshContextsClicked,
        variant: "outline" as const,
      },
    ],
  };

  const rows: CallContextRow[] = (contextsState.items || []).map((item) => ({
    ...item,
    updatedAt: item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "-",
    size: item.size ?? "-",
  }));

  const handleRowClick = (row: CallContextRow) => {
    const name = row.name || row.id;
    if (!name || !bus) return;

    upsertSidebarTab({
      id: CONTEXT_JSON_TAB_ID,
      title: "Context JSON",
      iconName: "json",
      order: 1000,
    });

    bus.present({
      widget: createContextJsonWidget(bus, { name }),
    });
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
      <InfiniteScrollDataTable
        data={rows}
        hasMore={contextsState.hasMore}
        loading={contextsState.loading}
        columns={callContextsColumns}
        onLoadMore={$contextsStore.loadMore}
        onRowClick={handleRowClick}
        viewMode="table"
        emptyMessage="No call contexts yet."
      />
    </HeaderPanelLayout>
  );
};
