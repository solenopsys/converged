import React, { useEffect } from 'react';
import { useUnit } from 'effector-react';
import { sample } from 'effector';

import { InfiniteScrollDataTable } from '../components/ui/table/InfiniteScrollDataTable';

import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { $rightSidebarWidth, sidebarWidthChanged } from "@/controllers";

// Фабрика для создания infinite scroll store
const createInfiniteTableStore = (domain, dataFunction) => {
  const loadDataFx = domain.createEffect({
    name: 'LOAD_DATA_INFINITE',
    handler: async (params) => {
      console.log('loadDataFx params:', params);

      const { offset = 0, limit = 20, sortBy, sortDirection, append = false, ...filters } = params || {};

      try {
        const result = await dataFunction({
          limit,
          offset,
          ...(sortBy && { sortBy, sortDirection }),
          ...filters
        });

        console.log('loadDataFx result:', result);
        return {
          items: result?.items || [],
          totalCount: result?.totalCount || 0,
          append
        };
      } catch (error) {
        console.error('loadDataFx error:', error);
        throw error;
      }
    }
  });

  const loadMore = domain.createEvent('LOAD_MORE_EVENT');
  const setSort = domain.createEvent('SET_SORT_INFINITE_EVENT');
  const reset = domain.createEvent('RESET_INFINITE_EVENT');
  const setFilters = domain.createEvent('SET_FILTERS_EVENT');

  const $state = domain.createStore({
    items: [],
    totalCount: 0,
    loading: false,
    loadingMore: false,
    error: null,
    offset: 0,
    limit: 20,
    hasMore: true,
    sortConfig: { key: null, direction: 'asc' },
    filters: {},
    isInitialized: false
  })
    .on(setSort, (state, sortConfig) => ({
      ...state,
      sortConfig,
      items: [],
      offset: 0,
      hasMore: true
    }))
    .on(setFilters, (state, filters) => ({
      ...state,
      filters,
      items: [],
      offset: 0,
      hasMore: true,
      isInitialized: false
    }))
    .on(loadDataFx.pending, (state, pending) => {
      // Если items пустой, это первая загрузка, иначе - загрузка дополнительных данных
      if (state.items.length === 0 && pending) {
        return { ...state, loading: true, loadingMore: false };
      } else if (pending) {
        return { ...state, loading: false, loadingMore: true };
      } else {
        return { ...state, loading: false, loadingMore: false };
      }
    })
    .on(loadDataFx.doneData, (state, { items, totalCount, append }) => {
      console.log('Store updated with:', {
        append,
        receivedItems: items.length,
        currentItems: state.items.length,
        totalCount
      });

      const newItems = append ? [...state.items, ...items] : items;
      const newOffset = newItems.length;
      const hasMore = newItems.length < totalCount;

      console.log('New state:', {
        itemsCount: newItems.length,
        offset: newOffset,
        hasMore,
        totalCount
      });

      return {
        ...state,
        items: newItems,
        totalCount: totalCount || 0,
        offset: newOffset,
        hasMore,
        loading: false,
        loadingMore: false,
        error: null,
        isInitialized: true
      };
    })
    .on(loadDataFx.failData, (state, error) => {
      console.error('Store error:', error);
      return {
        ...state,
        error: error.message,
        loading: false,
        loadingMore: false
      };
    })
    .on(reset, () => ({
      items: [],
      totalCount: 0,
      loading: false,
      loadingMore: false,
      error: null,
      offset: 0,
      limit: 20,
      hasMore: true,
      sortConfig: { key: null, direction: 'asc' },
      filters: {},
      isInitialized: false
    }));

  // Загрузка первой порции или дополнительных данных
  sample({
    clock: loadMore,
    source: $state,
    filter: (state) => {
      // Не загружаем если уже идет загрузка или больше нет данных
      const shouldLoad = !state.loading && !state.loadingMore && state.hasMore;
      console.log('loadMore filter:', { shouldLoad, loading: state.loading, loadingMore: state.loadingMore, hasMore: state.hasMore });
      return shouldLoad;
    },
    fn: (state, params = {}) => {
      const isAppend = state.items.length > 0;
      const offset = state.items.length; // offset = количество уже загруженных элементов

      console.log('loadMore fn:', {
        offset,
        itemsLength: state.items.length,
        isAppend,
        limit: state.limit
      });

      return {
        offset,
        limit: state.limit,
        sortBy: state.sortConfig.key,
        sortDirection: state.sortConfig.direction,
        append: isAppend,
        ...state.filters,
        ...params
      };
    },
    target: loadDataFx
  });

  // Перезагрузка при изменении сортировки
  sample({
    clock: setSort,
    source: $state,
    fn: (state) => ({
      offset: 0,
      limit: state.limit,
      sortBy: state.sortConfig.key,
      sortDirection: state.sortConfig.direction,
      append: false,
      ...state.filters
    }),
    target: loadDataFx
  });

  // Перезагрузка при изменении фильтров
  sample({
    clock: setFilters,
    source: $state,
    fn: (state) => ({
      offset: 0,
      limit: state.limit,
      sortBy: state.sortConfig.key,
      sortDirection: state.sortConfig.direction,
      append: false,
      ...state.filters
    }),
    target: loadDataFx
  });

  return { $state, loadMore, setSort, setFilters, reset, loadDataFx };
};

const InfiniteTableView = ({
  store,
  columns,
  title,
  tableId,
  viewMode = 'table',
  CardComponent = null,
  responsiveBreakpoint = 768,
  selectable = true,
  onRowClick,
  onSidebarStateChange,
  SidebarComponent = null,
  sidebarProps = {},
  isSidebarOpen = false,
  filters = {}
}) => {
  const {
    items,
    totalCount,
    loading,
    loadingMore,
    error,
    hasMore,
    sortConfig
  } = useUnit(store.$state);

  const { loadMore, setSort, setFilters } = useUnit(store);

  const rightSidebarWidth = useUnit($rightSidebarWidth);
  const setRightSidebarWidth = (width: number) => sidebarWidthChanged({ side: 'right', width });

  const isInitialized = useUnit(store.$state.map(s => s.isInitialized));
  const { reset } = useUnit(store);

  // Начальная загрузка данных при монтировании
  useEffect(() => {
    console.log('InfiniteTableView mounted, loading initial data...');
    loadMore({ offset: 0 });

    // Сброс состояния при размонтировании компонента
    return () => {
      console.log('InfiniteTableView unmounting, resetting state...');
      reset();
    };
  }, []);

  // Обновление фильтров
  useEffect(() => {
    if (Object.keys(filters).length > 0) {
      console.log('Filters changed, reloading data...', filters);
      setFilters(filters);
    }
  }, [JSON.stringify(filters), setFilters]);

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      console.log('Loading more data...');
      loadMore();
    } else {
      console.log('Skipping loadMore:', { loading, loadingMore, hasMore });
    }
  };

  const handleSort = (columnId, direction) => {
    const newSort = { key: columnId, direction };
    setSort(newSort);
  };

  console.log('InfiniteTableView render:', {
    items: items?.length,
    totalCount,
    loading,
    loadingMore,
    hasMore,
    error
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
    <SidebarProvider
      open={isSidebarOpen}
      className="h-full !min-h-0"
      style={{ height: '100%', minHeight: 0 }}
    >
      <SidebarInset className="min-h-0">
        <header className="flex h-10 shrink-0 items-center gap-2 border-b px-4 bg-background/90">
          <h1 className="text-base font-semibold">{title}</h1>
          {isSidebarOpen && SidebarComponent && (
            <SidebarTrigger
              className="-mr-1 ml-auto rotate-180"
              onClick={() => onSidebarStateChange?.(!isSidebarOpen)}
            />
          )}
        </header>

        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          <InfiniteScrollDataTable
            tableId={tableId}
            columns={columns}
            data={items || []}
            hasMore={hasMore}
            loading={loading}
            loadingMore={loadingMore}
            viewMode={viewMode}
            CardComponent={CardComponent}
            responsiveBreakpoint={responsiveBreakpoint}
            selectable={selectable}
            sortConfig={sortConfig}
            onRowClick={onRowClick}
            onLoadMore={handleLoadMore}
            onSort={handleSort}
          />
        </div>
      </SidebarInset>

      {isSidebarOpen && SidebarComponent && (
        <SidebarComponent side="right" {...resolvedSidebarProps} />
      )}
    </SidebarProvider>
  );
};

export { InfiniteTableView, createInfiniteTableStore };
