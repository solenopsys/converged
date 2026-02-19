import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanel, InfiniteScrollDataTable } from "front-core";
import { RefreshCw } from "lucide-react";
import { $historyStore, historyViewMounted, refreshHistoryClicked } from "../domain-history";
import { getTableColumns } from "front-core";

const historyColumns = getTableColumns([
  { id: "firedAt", title: "Fired At", type: "date", tableVisible: true, minWidth: 180 },
  { id: "cronName", title: "Cron", type: "text", tableVisible: true, minWidth: 150 },
  { id: "provider", title: "Provider", type: "text", tableVisible: true, minWidth: 100 },
  { id: "action", title: "Action", type: "text", tableVisible: true, minWidth: 100 },
  { id: "message", title: "Message", type: "text", tableVisible: true, minWidth: 200 },
]);

export const HistoryView = () => {
  const historyState = useUnit($historyStore.$state);

  useEffect(() => {
    historyViewMounted();
  }, []);

  const headerConfig = {
    title: "History",
    actions: [
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshHistoryClicked,
        variant: "outline" as const,
      },
    ],
  };

  return (
    <div className="flex flex-col h-full">
      <HeaderPanel config={headerConfig} />
      <div className="flex-1 overflow-hidden p-4">
        <InfiniteScrollDataTable
          data={historyState.items}
          hasMore={historyState.hasMore}
          loading={historyState.loading}
          columns={historyColumns}
          onLoadMore={$historyStore.loadMore}
          viewMode="table"
        />
      </div>
    </div>
  );
};

export default HistoryView;
