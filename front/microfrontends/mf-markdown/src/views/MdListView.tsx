import { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanel, InfiniteScrollDataTable } from "front-core";
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
    <div className="flex flex-col h-full">
      <HeaderPanel config={headerConfig} />
      <div className="flex-1 overflow-hidden p-4">
        <InfiniteScrollDataTable
          data={mdState.items}
          hasMore={mdState.hasMore}
          loading={mdState.loading}
          columns={mdColumns}
          onLoadMore={$mdStore.loadMore}
          viewMode="table"
        />
      </div>
    </div>
  );
};
