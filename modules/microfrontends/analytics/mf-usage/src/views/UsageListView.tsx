import React, { useEffect } from "preact/compat";
import { useUnit } from "effector-preact";
import { HeaderPanelLayout, InfiniteScrollDataTable } from "front-core";
import { RefreshCw } from "front-core";
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
    <HeaderPanelLayout config={headerConfig}>
        <InfiniteScrollDataTable
          data={usageState.items}
          hasMore={usageState.hasMore}
          loading={usageState.loading}
          columns={usageColumns}
          onLoadMore={$usageStore.loadMore}
          viewMode="table"
        />
    </HeaderPanelLayout>
  );
};

export default UsageListView;
