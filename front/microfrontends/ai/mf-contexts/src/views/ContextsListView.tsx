import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import {
  HeaderPanelLayout,
  InfiniteScrollDataTable,
  upsertSidebarTab,
} from "front-core";
import { RefreshCw, Plus } from "lucide-react";
import {
  $contextsStore,
  contextsViewMounted,
  refreshContextsClicked,
} from "../domain-contexts";
import { contextsColumns } from "../config";
import { ContextEditView } from "./ContextEditView";

const CONTEXT_EDIT_TAB_ID = "context-edit";

const createEditWidget = (
  bus: any,
  params: { name?: string; language?: string },
) => ({
  view: ContextEditView,
  placement: () => `sidebar:tab:${CONTEXT_EDIT_TAB_ID}`,
  config: { ...params, bus },
  commands: {},
});

function openEditor(bus: any, params: { name?: string; language?: string }) {
  upsertSidebarTab({
    id: CONTEXT_EDIT_TAB_ID,
    title: params.name ? `Context: ${params.name}` : "New context",
    iconName: "json",
    order: 1000,
  });
  bus.present({ widget: createEditWidget(bus, params) });
}

export const ContextsListView = ({ bus }: { bus: any }) => {
  const contextsState = useUnit($contextsStore.$state);

  useEffect(() => {
    contextsViewMounted();
  }, []);

  const headerConfig = {
    title: "Contexts",
    actions: [
      {
        id: "new",
        label: "New",
        icon: Plus,
        event: () => openEditor(bus, {}),
        variant: "default" as const,
      },
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshContextsClicked,
        variant: "outline" as const,
      },
    ],
  };

  const items = (contextsState.items || []).map((item: any) => ({
    ...item,
    updatedAt: item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "-",
    size: item.size ?? "-",
  }));

  const handleRowClick = (row: any) => {
    if (!row?.name) return;
    openEditor(bus, { name: row.name, language: row.language });
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
      <InfiniteScrollDataTable
        data={items}
        hasMore={contextsState.hasMore}
        loading={contextsState.loading}
        columns={contextsColumns}
        onLoadMore={$contextsStore.loadMore}
        onRowClick={handleRowClick}
        viewMode="table"
      />
    </HeaderPanelLayout>
  );
};
