import React, { useState, useEffect, useMemo } from 'react';
import { ViewProps } from "./types"; 
 
import { useMicrofrontendTranslation } from '@/hooks/global_i18n';

import { UniversalDataTable } from '../components/ui';

import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger
} from "@/components/ui/sidebar";

const TableView = ({
  columns,
  title,
  dataFunction,
  onRowClick,
  onSidebarStateChange,
  SidebarComponent = null,
  sidebarProps = {},
  isSidebarOpen = false,
  defaultPageSize = 20,
  pageSizeOptions = [10, 20, 50, 100]
}: ViewProps) => {
  console.log("TABLE VIEW init")

  const [data, setData] = useState({ items: [], totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Состояние пагинации
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Функция загрузки данных
  const fetchData = async (page = currentPage, size = pageSize, sort = sortConfig) => {
    try {
      console.log("TABLE VIEW start load data")
      setLoading(true);
      setError(null);
              
      // Проверяем, что dataFunction действительно функция
      if (typeof dataFunction !== 'function') {
        throw new Error('dataFunction должен быть функцией');
      }
      
      // Вычисляем offset для API
      const offset = (page - 1) * size;
      
      // Подготавливаем параметры для запроса
      const params = {
        limit: size,
        offset: offset
      };
      
      // Добавляем сортировку если есть
      if (sort.key) {
        params.sortBy = sort.key;
        params.sortDirection = sort.direction;
      }
              
      const result = await dataFunction(params);
      setData(result || { items: [], totalCount: 0 });
    } catch (err) {
      console.error('Ошибка при загрузке данных:', err);
      setError(err.message || 'Ошибка загрузки данных');
      setData({ items: [], totalCount: 0 });
    } finally {
      setLoading(false);
    }
  };

  // Загружаем данные при изменении параметров
  useEffect(() => {
    console.log("TABLE VIEW useEffect",dataFunction)
    if (dataFunction) {
      console.log("TABLE VIEW fetchData")
      fetchData(currentPage, pageSize, sortConfig);
    }
  }, [dataFunction, currentPage, pageSize, sortConfig]);

  // Функция для обработки клика по строке
  const handleRowClick = (row) => {
    console.log('Row clicked:', row);
    if (onRowClick) {
      onRowClick(row);
    }
  };

  // Обработчик изменения страницы
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Обработчик изменения размера страницы
  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Сбрасываем на первую страницу
  };

  // Обработчик сортировки
  const handleSort = (columnId, direction) => {
    setSortConfig({ key: columnId, direction });
    setCurrentPage(1); // Сбрасываем на первую страницу при сортировке
  };

  // Обработчик изменения состояния сайдбара
  const handleSidebarToggle = () => {
    if (onSidebarStateChange) {
      onSidebarStateChange(!isSidebarOpen);
    }
  };

  // Провайдер данных для таблицы
  const dataProvider = useMemo(() => {
    return () => {
      return data?.items || [];
    };
  }, [data]);

  if (loading && currentPage === 1) return <div>Загрузка...</div>;
  if (error) return <div>Ошибка: {error}</div>;

  return (
    <SidebarProvider open={isSidebarOpen}>
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <h1 className="text-lg font-semibold">{title}</h1>
          {isSidebarOpen && SidebarComponent && (
            <SidebarTrigger 
              className="-mr-1 ml-auto rotate-180"
              onClick={handleSidebarToggle}
            />
          )}
        </header>
                
        <div className="flex flex-1 flex-col p-4">
          <div className="h-full">
            <UniversalDataTable
              columns={columns}
              dataProvider={dataProvider}
              onRowClick={handleRowClick}
              serverSide={true}
              totalItems={data.totalCount}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              onSort={handleSort}
              loading={loading}
              pageSizeOptions={pageSizeOptions}
            />
          </div>
        </div>
      </SidebarInset>
            
      {isSidebarOpen && SidebarComponent && (
        <SidebarComponent side="right" {...sidebarProps} />
      )}
    </SidebarProvider>
  );
};

export { TableView };