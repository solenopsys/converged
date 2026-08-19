import React, { useEffect } from 'preact/compat';
import { useUnit } from 'effector-preact';
import { HeaderPanelLayout, InfiniteScrollDataTable } from 'front-core';
import { RefreshCw } from "front-core";
import { $contextsStore, refreshContextsClicked, openContextDetail } from '../domain-contexts';
import { createContextWidget } from '../functions/context';
import { contextsColumns } from '../functions/columns';

export const ContextsView = ({ bus }) => {
  const state = useUnit($contextsStore.$state);

  useEffect(() => {
    if (!state.isInitialized && !state.loading) {
      $contextsStore.loadMore({});
    }
  }, []);

  const headerConfig = {
    title: 'Contexts',
    actions: [
      {
        id: 'refresh',
        label: 'Refresh',
        icon: RefreshCw,
        event: refreshContextsClicked,
        variant: 'outline' as const,
      },
    ],
  };

  const handleRowClick = (row: { id: string; name?: string }) => {
    openContextDetail({ contextId: row.id });
    bus.present({
      widget: createContextWidget(bus),
      params: { contextId: row.id, entity: row },
      tab: { key: `dag.context:${row.id}`, title: row.name ?? row.id },
    });
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
        <InfiniteScrollDataTable
          data={state.items}
          hasMore={state.hasMore}
          loading={state.loading}
          columns={contextsColumns}
          onRowClick={handleRowClick}
          onLoadMore={$contextsStore.loadMore}
          viewMode="table"
        />
    </HeaderPanelLayout>
  );
};
