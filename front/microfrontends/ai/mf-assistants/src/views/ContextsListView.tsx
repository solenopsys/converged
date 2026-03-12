import React, { useEffect, useState } from "react";
import { useUnit } from "effector-react";
import { HeaderPanelLayout, InfiniteScrollDataTable } from "front-core";
import { RefreshCw } from "lucide-react";
import {
  $contextsStore,
  contextsViewMounted,
  refreshContextsClicked,
} from "../domain-contexts";
import { contextsColumns } from "../config";
import { assistantClient } from "../services";
import type { ChatContext } from "../types";

export const ContextsListView = ({ bus: _bus }) => {
  const contextsState = useUnit($contextsStore.$state);
  const [selectedContext, setSelectedContext] = useState<ChatContext | null>(
    null,
  );
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);

  useEffect(() => {
    contextsViewMounted();
  }, []);

  const headerConfig = {
    title: "Contexts",
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

  const items = (contextsState.items || []).map((item) => ({
    ...item,
    updatedAt: item.updatedAt
      ? new Date(item.updatedAt).toLocaleString()
      : "-",
    size: item.size ?? "-",
  }));

  const handleRowClick = async (row) => {
    const chatId = row.chatId || row.id;
    if (!chatId) return;

    setContextLoading(true);
    setContextError(null);

    try {
      const context = await assistantClient.getContext(chatId);
      setSelectedContext(context);
    } catch (error: any) {
      setContextError(error?.message || "Failed to load context");
      setSelectedContext(null);
    } finally {
      setContextLoading(false);
    }
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
      <div className="flex flex-col h-full">
        <InfiniteScrollDataTable
          data={items}
          hasMore={contextsState.hasMore}
          loading={contextsState.loading}
          columns={contextsColumns}
          onLoadMore={$contextsStore.loadMore}
          onRowClick={handleRowClick}
          viewMode="table"
        />
        <div className="border-t bg-muted/30 p-4">
          <div className="text-sm font-semibold">Context JSON</div>
          {contextLoading && (
            <div className="mt-2 text-sm text-muted-foreground">Loading...</div>
          )}
          {!contextLoading && contextError && (
            <div className="mt-2 text-sm text-destructive">{contextError}</div>
          )}
          {!contextLoading && !contextError && selectedContext && (
            <pre className="mt-2 max-h-56 overflow-auto rounded-md bg-background p-3 text-xs">
              {JSON.stringify(selectedContext.data, null, 2)}
            </pre>
          )}
          {!contextLoading && !contextError && !selectedContext && (
            <div className="mt-2 text-sm text-muted-foreground">
              Select a row to view the context.
            </div>
          )}
        </div>
      </div>
    </HeaderPanelLayout>
  );
};
