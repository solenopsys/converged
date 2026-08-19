import React, { useCallback, useEffect, useMemo } from 'preact/compat';
import { useUnit } from 'effector-preact';
import { Archive, HeaderPanelLayout, InfiniteScrollDataTable, RefreshCw } from 'front-core';
import {
  $storageStats,
  $storageStatsLoading,
  storageStatsViewMounted,
  refreshStorageStats,
} from '../domain-storage-stats';
import { StorageDashboardView } from './StorageDashboardView';
import { storagesColumns } from '../functions/columns';
import dumpsService from '../service';

const bulkActions = [
  { id: 'dump', label: 'Dump', icon: Archive },
];

export const StoragesView = ({ bus }: { bus: any }) => {
  const stats = useUnit($storageStats);
  const loading = useUnit($storageStatsLoading);

  useEffect(() => { storageStatsViewMounted(); }, []);

  const sorted = useMemo(
    () => [...stats.storages].sort((a, b) => b.size - a.size),
    [stats.storages],
  );

  const openStorageDashboard = useCallback((row: { name: string; size: number }) => {
    if (!bus || !row?.name) return;
    bus.present({
      widget: {
        view: StorageDashboardView,
        placement: () => 'center',
        config: { bus, storageName: row.name, storageSize: row.size, totalSize: stats.totalSize },
      },
    });
  }, [bus, stats.totalSize]);

  const columns = useMemo(
    () => (storagesColumns as any[]).map((column) => {
      if (column?.id !== 'name') return column;
      return {
        ...column,
        render: (value: any, rowData: any) => (
          <button
            type="button"
            className="text-left text-primary hover:underline"
            onClick={(e) => { e.stopPropagation(); openStorageDashboard(rowData); }}
          >
            {String(value ?? '')}
          </button>
        ),
      };
    }),
    [openStorageDashboard],
  );

  const handleBulkAction = useCallback(async (actionId: string, rows: any[]) => {
    for (const row of rows) {
      if (actionId === 'dump') await (dumpsService as any).createDump(row.name);
    }
    refreshStorageStats();
  }, []);

  const headerConfig = {
    title: 'Storages',
    actions: [
      { id: 'refresh', label: 'Refresh', icon: RefreshCw, event: refreshStorageStats, variant: 'outline' as const },
    ],
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
      <InfiniteScrollDataTable
        data={sorted}
        hasMore={false}
        loading={loading}
        columns={columns}
        onLoadMore={() => {}}
        bulkActions={bulkActions}
        onBulkAction={handleBulkAction}
        viewMode="table"
      />
    </HeaderPanelLayout>
  );
};
