import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import {
  HeaderPanelLayout,
  InfiniteScrollDataTable,
  upsertSidebarTab,
  useMicrofrontendTranslation,
} from "front-core";
import { RefreshCw } from "lucide-react";
import {
  $contextsStore,
  contextsViewMounted,
  refreshContextsClicked,
} from "../domain-contexts";
import { createContextsColumns } from "../config";
import { ContextJsonView } from "./ContextJsonView";

const CONTEXT_JSON_TAB_ID = "chat-context-json";

const createContextJsonWidget = (bus: any, params: { chatId: string }) => ({
  view: ContextJsonView,
  placement: () => `sidebar:tab:${CONTEXT_JSON_TAB_ID}`,
  config: {
    ...params,
    bus,
  },
  commands: {},
});

export const ContextsListView = ({ bus }) => {
  const contextsState = useUnit($contextsStore.$state);
  const { t } = useMicrofrontendTranslation("assistants-mf");

  useEffect(() => {
    contextsViewMounted();
  }, []);

  const headerConfig = {
    title: t("contextsList.title"),
    actions: [
      {
        id: "refresh",
        label: t("common.refresh"),
        icon: RefreshCw,
        event: refreshContextsClicked,
        variant: "outline" as const,
      },
    ],
  };

  const items = (contextsState.items || []).map((item) => ({
    ...item,
    updatedAt: item.updatedAt
      ? new Date(item.updatedAt).toLocaleString()
      : "-",
    size: item.size ?? "-",
  }));

  const handleRowClick = (row) => {
    const chatId = row.chatId || row.id;
    if (!chatId) return;

    upsertSidebarTab({
      id: CONTEXT_JSON_TAB_ID,
      title: t("contextsList.contextJson"),
      iconName: "json",
      order: 1000,
    });
    bus.present({
      widget: createContextJsonWidget(bus, {
        chatId,
      }),
    });
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
      <InfiniteScrollDataTable
        data={items}
        hasMore={contextsState.hasMore}
        loading={contextsState.loading}
        columns={createContextsColumns(t)}
        onLoadMore={$contextsStore.loadMore}
        onRowClick={handleRowClick}
        viewMode="table"
      />
    </HeaderPanelLayout>
  );
};
