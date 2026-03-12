import React, { useEffect } from "react";
import { useUnit } from "effector-react";

import { InfiniteScrollDataTable } from "front-core";

type TableStore = {
  $state: any;
  loadData: (params?: any) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSort: (sortConfig: { key: string; direction: string }) => void;
};

type ChatListViewProps = {
  store: TableStore;
  columns: any[];
  onRowClick?: (rowData: any) => void;
  onRowAction?: (actionId: string, rowData: any) => void;
  pageSizeOptions?: number[];
  filters?: Record<string, any>;
};

const ChatListView: React.FC<ChatListViewProps> = ({
  store,
  columns,
  onRowClick,
  onRowAction,
  pageSizeOptions = [10, 20, 50, 100],
  filters = {},
}) => {
  const { items, totalCount, loading, error, currentPage, pageSize, sortConfig } =
    useUnit(store.$state);
  const { loadData, setPage, setPageSize, setSort } = useUnit(store);

  useEffect(() => {
    loadData({ page: 1, pageSize, ...filters });
  }, [loadData, pageSize, JSON.stringify(filters)]);

  useEffect(() => {
    if (Object.keys(filters).length > 0) {
      loadData({ page: 1, pageSize, ...filters });
    }
  }, [JSON.stringify(filters)]);

  if (error) {
    return <div className="p-3 text-sm text-destructive">Ошибка: {error}</div>;
  }

  return (
    <div className="h-full">
      <InfiniteScrollDataTable
        columns={columns}
        data={items || []}
        onRowClick={onRowClick}
        onRowAction={onRowAction}
        loading={loading}
        viewMode="table"
      />
    </div>
  );
};

export { ChatListView };
