import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanelLayout, InfiniteScrollDataTable } from "front-core";
import { RefreshCw, Plus, Trash2 } from "lucide-react";
import {
  $cronsStore,
  cronsViewMounted,
  refreshCronsClicked,
  addCronClicked,
  openCronForm,
} from "../domain-crons";
import { cronsColumns } from "../functions/columns";
import { createCronFormWidget } from "../functions/crons.config";
import shedullerService from "../service";

export const CronsListView = ({ bus }) => {
  const cronsState = useUnit($cronsStore.$state);

  useEffect(() => {
    cronsViewMounted();

    const unwatch = addCronClicked.watch(() => {
      openCronForm({ cron: null });
      bus.present({ widget: createCronFormWidget(bus) });
    });

    return () => { unwatch(); };
  }, [bus]);

  const handleRowClick = (row) => {
    openCronForm({ cron: row });
    bus.present({ widget: createCronFormWidget(bus) });
  };

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
    selectionActions: [
      {
        id: "delete",
        label: (count: number) => `Delete (${count})`,
        icon: Trash2,
        variant: "destructive" as const,
        handler: async (rows) => {
          await Promise.all(rows.map((row) => shedullerService.deleteCron(row.id)));
          refreshCronsClicked();
        },
      },
    ],
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
      <InfiniteScrollDataTable
        data={cronsState.items}
        hasMore={cronsState.hasMore}
        loading={cronsState.loading}
        columns={cronsColumns}
        onLoadMore={$cronsStore.loadMore}
        onRowClick={handleRowClick}
        viewMode="table"
      />
    </HeaderPanelLayout>
  );
};

export default CronsListView;
