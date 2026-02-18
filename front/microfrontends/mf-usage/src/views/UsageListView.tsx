import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanel, InfiniteScrollDataTable } from "front-core";
import { RefreshCw } from "lucide-react";
import { $usageStore, usageViewMounted, refreshUsageClicked } from "../domain-usage";
import { usageColumns } from "../functions/columns";

export const UsageListView = () => {
  const usageState = useUnit($usageStore.$state);

  useEffect(() => {
    usageViewMounted();
  }, []);

  const headerConfig = {
    title: "Usage Events",
    actions: [
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshUsageClicked,
        variant: "outline" as const,
      },
    ],
  };

  return (
    <div className="flex flex-col h-full">
      <HeaderPanel config={headerConfig} />
      <div className="flex-1 overflow-hidden p-4">
        <InfiniteScrollDataTable
          data={usageState.items}
          hasMore={usageState.hasMore}
          loading={usageState.loading}
          columns={usageColumns}
          onLoadMore={$usageStore.loadMore}
          viewMode="table"
        />
      </div>
    </div>
  );
};

export default UsageListView;
