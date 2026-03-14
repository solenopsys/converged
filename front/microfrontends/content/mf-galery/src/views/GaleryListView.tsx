import { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanelLayout, InfiniteScrollDataTable } from "front-core";
import { RefreshCw } from "lucide-react";
import { $galeryStore, galeryViewMounted, refreshGaleryClicked } from "../domain-galery";
import { galeryColumns } from "../functions/columns";

export const GaleryListView = () => {
  const galeryState = useUnit($galeryStore.$state);

  useEffect(() => {
    galeryViewMounted();
  }, []);

  const headerConfig = {
    title: "Galery Items",
    actions: [
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshGaleryClicked,
        variant: "outline" as const,
      },
    ],
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
      <InfiniteScrollDataTable
        data={galeryState.items}
        hasMore={galeryState.hasMore}
        loading={galeryState.loading}
        columns={galeryColumns}
        onLoadMore={$galeryStore.loadMore}
        viewMode="table"
      />
    </HeaderPanelLayout>
  );
};
