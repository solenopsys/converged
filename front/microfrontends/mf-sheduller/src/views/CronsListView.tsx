import React, { useEffect, useState } from "react";
import { useUnit } from "effector-react";
import { createEvent } from "effector";
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

const deleteSelectedEvent = createEvent<any[]>("DELETE_SELECTED_CRONS");

export const CronsListView = ({ bus }) => {
  const cronsState = useUnit($cronsStore.$state);
  const [selected, setSelected] = useState<any[]>([]);

  useEffect(() => {
    cronsViewMounted();

    const unwatch = addCronClicked.watch(() => {
      openCronForm({ cron: null });
      bus.present({ widget: createCronFormWidget(bus) });
    });

    const unwatchDelete = deleteSelectedEvent.watch(async (rows) => {
      await Promise.all(rows.map((row) => shedullerService.deleteCron(row.id)));
      setSelected([]);
      refreshCronsClicked();
    });

    return () => {
      unwatch();
      unwatchDelete();
    };
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
      ...(selected.length > 0
        ? [
            {
              id: "delete",
              label: `Delete (${selected.length})`,
              icon: Trash2,
              event: deleteSelectedEvent,
              payload: selected,
              variant: "destructive" as const,
            },
          ]
        : []),
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
        onSelectionChange={(_ids, rows) => setSelected(rows)}
        viewMode="table"
      />
    </HeaderPanelLayout>
  );
};

export default CronsListView;
