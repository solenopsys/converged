import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanel, InfiniteScrollDataTable } from "front-core";
import { RefreshCw, Plus } from "lucide-react";
import {
  $cronsStore,
  cronsViewMounted,
  refreshCronsClicked,
  addCronClicked,
  openCronForm,
} from "../domain-crons";
import { cronsColumns } from "../functions/columns";
import { createCronFormWidget } from "../functions/crons.config";

export const CronsListView = ({ bus }) => {
  const cronsState = useUnit($cronsStore.$state);

  useEffect(() => {
    cronsViewMounted();

    const unwatch = addCronClicked.watch(() => {
      openCronForm({ cron: null });
      bus.present({ widget: createCronFormWidget(bus) });
    });

    return () => unwatch();
  }, [bus]);

  const headerConfig = {
    title: "Crons",
    actions: [
      {
        id: "add",
        label: "Add Cron",
        icon: Plus,
        event: addCronClicked,
        variant: "default" as const,
      },
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshCronsClicked,
        variant: "outline" as const,
      },
    ],
  };

  const handleRowClick = (row) => {
    openCronForm({ cron: row });
    bus.present({ widget: createCronFormWidget(bus) });
  };

  return (
    <div className="flex flex-col h-full">
      <HeaderPanel config={headerConfig} />
      <div className="flex-1 overflow-hidden p-4">
        <InfiniteScrollDataTable
          data={cronsState.items}
          hasMore={cronsState.hasMore}
          loading={cronsState.loading}
          columns={cronsColumns}
          onLoadMore={$cronsStore.loadMore}
          onRowClick={handleRowClick}
          viewMode="table"
        />
      </div>
    </div>
  );
};

export default CronsListView;
