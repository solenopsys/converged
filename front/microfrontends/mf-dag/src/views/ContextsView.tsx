import React, { useEffect } from 'react';
import { useUnit } from 'effector-react';
import { HeaderPanel, InfiniteScrollDataTable } from 'front-core';
import { RefreshCw } from 'lucide-react';
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

  const handleRowClick = (row: { id: string }) => {
    openContextDetail({ contextId: row.id });
    bus.present({ widget: createContextWidget(bus), params: { contextId: row.id } });
  };

  return (
    <div className="flex flex-col h-full">
      <HeaderPanel config={headerConfig} />
      <div className="flex-1 overflow-hidden p-4">
        <InfiniteScrollDataTable
          data={state.items}
          hasMore={state.hasMore}
          loading={state.loading}
          columns={contextsColumns}
          onRowClick={handleRowClick}
          onLoadMore={$contextsStore.loadMore}
          viewMode="table"
        />
      </div>
    </div>
  );
};
