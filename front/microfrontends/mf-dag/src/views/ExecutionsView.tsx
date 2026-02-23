import React, { useEffect } from 'react';
import { useUnit } from 'effector-react';
import { HeaderPanelLayout, InfiniteScrollDataTable } from 'front-core';
import { RefreshCw } from 'lucide-react';
import { $executionsStore, refreshExecutionsClicked } from '../domain-executions';
import { createContextWidget, openContextDetail } from '../functions/context';
import { executionsColumns } from '../functions/columns';

export const ExecutionsView = ({ bus }) => {
  const state = useUnit($executionsStore.$state);

  useEffect(() => {
    if (!state.isInitialized && !state.loading) {
      $executionsStore.loadMore({});
    }
  }, []);

  const headerConfig = {
    title: 'Executions',
    actions: [
      {
        id: 'refresh',
        label: 'Refresh',
        icon: RefreshCw,
        event: refreshExecutionsClicked,
        variant: 'outline' as const,
      },
    ],
  };

  const handleRowClick = (row: { id: string }) => {
    openContextDetail({ contextId: row.id });
    bus.present({ widget: createContextWidget(bus) });
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
        <InfiniteScrollDataTable
          data={state.items}
          hasMore={state.hasMore}
          loading={state.loading}
          columns={executionsColumns}
          onRowClick={handleRowClick}
          onLoadMore={$executionsStore.loadMore}
          viewMode="table"
        />
    </HeaderPanelLayout>
  );
};
