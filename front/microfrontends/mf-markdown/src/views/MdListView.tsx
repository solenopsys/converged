import { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanelLayout, InfiniteScrollDataTable } from "front-core";
import { RefreshCw } from "lucide-react";
import { $mdStore, mdViewMounted, refreshMdClicked } from "../domain-markdown";
import { mdColumns } from "../functions/columns";

export const MdListView = () => {
  const mdState = useUnit($mdStore.$state);

  useEffect(() => {
    mdViewMounted();
  }, []);

  const headerConfig = {
    title: "Markdown Files",
    actions: [
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshMdClicked,
        variant: "outline" as const,
      },
    ],
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
        <InfiniteScrollDataTable
          data={mdState.items}
          hasMore={mdState.hasMore}
          loading={mdState.loading}
          columns={mdColumns}
          onLoadMore={$mdStore.loadMore}
          viewMode="table"
        />
    </HeaderPanelLayout>
  );
};
