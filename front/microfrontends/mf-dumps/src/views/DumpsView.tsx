import React, { useEffect } from 'react';
import { useUnit } from 'effector-react';
import { HeaderPanel, InfiniteScrollDataTable } from 'front-core';
import { RefreshCw } from 'lucide-react';
import type { DumpsMode } from '../domain-dumps';
import { $dumpsStore, dumpsViewMounted, refreshDumpsClicked } from '../domain-dumps';
import { dumpsColumns, storagesColumns } from '../functions/columns';

interface DumpsViewProps {
  mode?: DumpsMode;
}

export const DumpsView = ({ mode = 'dumps' }: DumpsViewProps) => {
  const dumpsState = useUnit($dumpsStore.$state);
  const columns = mode === 'storages' ? storagesColumns : dumpsColumns;

  useEffect(() => {
    dumpsViewMounted({ mode });
  }, [mode]);

  const headerConfig = {
    title: mode === 'storages' ? 'Storages' : 'Dumps',
    actions: [
      {
        id: 'refresh',
        label: 'Refresh',
        icon: RefreshCw,
        event: refreshDumpsClicked,
        variant: 'outline' as const,
      },
    ],
  };

  return (
    <div className="flex flex-col h-full">
      <HeaderPanel config={headerConfig} />
      <div className="flex-1 overflow-hidden p-4">
        <InfiniteScrollDataTable
          data={dumpsState.items}
          hasMore={dumpsState.hasMore}
          loading={dumpsState.loading}
          columns={columns}
          onLoadMore={$dumpsStore.loadMore}
          viewMode="table"
        />
      </div>
    </div>
  );
};
