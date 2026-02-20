import React, { useEffect } from 'react';
import { useUnit } from 'effector-react';
import { HeaderPanel, InfiniteScrollDataTable } from 'front-core';
import { RefreshCw } from 'lucide-react';
import { $executionsStore, refreshExecutionsClicked } from '../domain-executions';
import { openContextDetail } from '../domain-contexts';
import { createContextWidget } from '../functions/context';
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

  const handleRowClick = (row: { processId: string }) => {
    openContextDetail({ contextId: row.processId });
    bus.present({ widget: createContextWidget(bus), params: { contextId: row.processId } });
  };

  return (
    <div className="flex flex-col h-full">
      <HeaderPanel config={headerConfig} />
      <div className="flex-1 overflow-hidden p-4">
        <InfiniteScrollDataTable
          data={state.items}
          hasMore={state.hasMore}
          loading={state.loading}
          columns={executionsColumns}
          onRowClick={handleRowClick}
          onLoadMore={$executionsStore.loadMore}
          viewMode="table"
        />
      </div>
    </div>
  );
};
