import { useEffect } from "preact/compat";
import { useUnit } from "effector-preact";
import { HeaderPanelLayout, InfiniteScrollDataTable } from "front-core";
import { RefreshCw } from "front-core";
import { $structStore, structViewMounted, refreshStructClicked } from "../domain-struct";
import { structColumns } from "../functions/columns";

export const StructListView = () => {
  const structState = useUnit($structStore.$state);

  useEffect(() => {
    structViewMounted();
  }, []);

  const headerConfig = {
    title: "Struct Files",
    actions: [
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshStructClicked,
        variant: "outline" as const,
      },
    ],
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
      <InfiniteScrollDataTable
        data={structState.items}
        hasMore={structState.hasMore}
        loading={structState.loading}
        columns={structColumns}
        onLoadMore={$structStore.loadMore}
        viewMode="table"
      />
    </HeaderPanelLayout>
  );
};
