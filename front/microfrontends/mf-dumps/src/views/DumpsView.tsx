import React, { useEffect } from 'react';
import { useUnit } from 'effector-react';
import { HeaderPanelLayout, InfiniteScrollDataTable } from 'front-core';
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
    <HeaderPanelLayout config={headerConfig}>
        <InfiniteScrollDataTable
          data={dumpsState.items}
          hasMore={dumpsState.hasMore}
          loading={dumpsState.loading}
          columns={columns}
          onLoadMore={$dumpsStore.loadMore}
          viewMode="table"
        />
    </HeaderPanelLayout>
  );
};
