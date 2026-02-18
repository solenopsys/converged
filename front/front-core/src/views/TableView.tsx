import React, { useEffect } from 'react';
import { useUnit } from 'effector-react';
import { sample } from 'effector';

import { InfiniteScrollDataTable } from '../components/ui';

import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { $rightSidebarWidth, sidebarWidthChanged } from "@/controllers";

// Простая фабрика для создания table store в одну строчку
export const createTableStore = (domain, dataFunction) => {
  const loadDataFx = domain.createEffect({
    name: 'LOAD_DATA',
    handler: async (params) => {
      console.log('loadDataFx params:', params); // Для отладки

      const { page = 1, pageSize = 20, sortBy, sortDirection, ...filters } = params || {};
      const offset = (page - 1) * pageSize;

      try {
        const result = await dataFunction({
          limit: pageSize,
          offset,
          ...(sortBy && { sortBy, sortDirection }),
          ...filters
        });

        console.log('loadDataFx result:', result); // Для отладки
        return result || { items: [], totalCount: 0 };
      } catch (error) {
        console.error('loadDataFx error:', error);
        throw error;
      }
    }
  });

  const loadData = domain.createEvent('LOAD_DATA_EVENT');
  const setPage = domain.createEvent('SET_PAGE_EVENT');
  const setPageSize = domain.createEvent('SET_PAGE_SIZE_EVENT');
  const setSort = domain.createEvent('SET_SORT_EVENT');
  const reset = domain.createEvent('RESET_EVENT');

  const $state = domain.createStore({
    items: [],
    totalCount: 0,
    loading: false,
    error: null,
    currentPage: 1,
    pageSize: 20,
    sortConfig: { key: null, direction: 'asc' }
  })
    .on(setPage, (state, page) => ({ ...state, currentPage: page }))
    .on(setPageSize, (state, pageSize) => ({ ...state, pageSize, currentPage: 1 }))
    .on(setSort, (state, sortConfig) => ({ ...state, sortConfig, currentPage: 1 }))
    .on(loadDataFx.pending, (state, loading) => ({ ...state, loading }))
    .on(loadDataFx.doneData, (state, { items, totalCount }) => {
      console.log('Store updated with:', { items, totalCount }); // Для отладки
      return {
        ...state,
        items: items || [],
        totalCount: totalCount || 0,
        error: null
      };
    })
    .on(loadDataFx.failData, (state, error) => {
      console.error('Store error:', error); // Для отладки
      return {
        ...state,
        error: error.message,
        items: [],
        totalCount: 0
      };
    })
    .on(reset, () => ({
      items: [], totalCount: 0, loading: false, error: null,
      currentPage: 1, pageSize: 20, sortConfig: { key: null, direction: 'asc' }
    }));

  // Связываем события с эффектом
  sample({
    clock: loadData,
    source: $state,
    fn: (state, params) => ({
      page: state.currentPage,
      pageSize: state.pageSize,
      sortBy: state.sortConfig.key,
      sortDirection: state.sortConfig.direction,
      ...params
    }),
    target: loadDataFx
  });

  return { $state, loadData, setPage, setPageSize, setSort, reset, loadDataFx };
};

const TableView = ({
  store,
  columns,
  title,
  onRowClick,
  onSidebarStateChange,
  SidebarComponent = null,
  sidebarProps = {},
  isSidebarOpen = false,
  pageSizeOptions = [10, 20, 50, 100],
  filters = {}
}) => {
  const { items, totalCount, loading, error, currentPage, pageSize, sortConfig } = useUnit(store.$state);
  const { loadData, setPage, setPageSize, setSort } = useUnit(store);
  const rightSidebarWidth = useUnit($rightSidebarWidth);
  const setRightSidebarWidth = (width: number) => sidebarWidthChanged({ side: 'right', width });

  // Добавляем начальную загрузку данных
  useEffect(() => {
    console.log('TableView mounted/updated, loading initial data for this store...');
    // стартуем с первой страницы для нового store
    loadData({ page: 1, pageSize, ...filters });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData, pageSize, JSON.stringify(filters)]);


  // Перезагружаем данные при изменении фильтров
  useEffect(() => {
    if (Object.keys(filters).length > 0) {
      console.log('Filters changed, reloading data...', filters); // Для отладки
      loadData({
        page: 1,
        pageSize,
        ...filters
      });
    }
  }, [JSON.stringify(filters)]); // Следим за изменениями фильтров

  const handlePageChange = (page) => {
    setPage(page);
    loadData({
      page,
      pageSize,
      ...(sortConfig.key && { sortBy: sortConfig.key, sortDirection: sortConfig.direction }),
      ...filters
    });
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    loadData({
      page: 1,
      pageSize: newPageSize,
      ...(sortConfig.key && { sortBy: sortConfig.key, sortDirection: sortConfig.direction }),
      ...filters
    });
  };

  const handleSort = (columnId, direction) => {
    const newSort = { key: columnId, direction };
    setSort(newSort);
    loadData({
      page: 1,
      pageSize,
      sortBy: columnId,
      sortDirection: direction,
      ...filters
    });
  };

  // Добавляем больше информации для отладки
  console.log('TableView render:', {
    items: items?.length,
    totalCount,
    loading,
    error,
    currentPage,
    pageSize
  });

  if (error) return <div>Ошибка: {error}</div>;

  const resolvedSidebarProps = {
    resizable: true,
    minWidth: 240,
    maxWidth: 760,
    ...sidebarProps,
    width: typeof sidebarProps?.width === "number" ? sidebarProps.width : rightSidebarWidth,
    onWidthChange: sidebarProps?.onWidthChange ?? setRightSidebarWidth,
  };

  return (
    <SidebarProvider open={isSidebarOpen}>
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <h1 className="text-lg font-semibold">{title}</h1>
          {isSidebarOpen && SidebarComponent && (
            <SidebarTrigger
              className="-mr-1 ml-auto rotate-180"
              onClick={() => onSidebarStateChange?.(!isSidebarOpen)}
            />
          )}
        </header>

        <div className="flex flex-1 flex-col p-4">
          <div className="h-full">
            <InfiniteScrollDataTable
              columns={columns}
              data={items || []}
              onRowClick={onRowClick}
              loading={loading}
              viewMode="table"
            />
          </div>
        </div>
      </SidebarInset>

      {isSidebarOpen && SidebarComponent && (
        <SidebarComponent side="right" {...resolvedSidebarProps} />
      )}
    </SidebarProvider>
  );
};

export { TableView };
