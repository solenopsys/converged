import React from "react";
 
import { UniversalDataTable } from "converged-core";

import {COLUMN_TYPES} from "converged-core";

import { useState, useCallback, useEffect } from 'react'; 

import { Eye, Edit3, Trash2, Archive, Copy } from "lucide-react";

import { SearchInput } from "converged-core";

import { useGlobalTranslation } from "converged-core";

function Chats() {
  const { i18n } = useGlobalTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [chatsData, setChatsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Загрузка данных с сервера
  useEffect(() => {
    const fetchChats = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:3001/chats');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setChatsData(data);
      } catch (err) {
        console.error('Ошибка при загрузке чатов:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchChats();
  }, []);

  // DataProvider с поиском и сортировкой
  const dataProvider = useCallback((sortConfig) => {
    let filteredData = chatsData;

    // Поиск
    if (searchTerm) {
      filteredData = chatsData.filter(item =>
        Object.values(item).some(value => {
          if (Array.isArray(value)) {
            return value.some(v => v.toString().toLowerCase().includes(searchTerm.toLowerCase()));
          }
          return value?.toString().toLowerCase().includes(searchTerm.toLowerCase());
        })
      );
    }

    // Сортировка
    if (sortConfig?.key) {
      filteredData = [...filteredData].sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return 1;
        if (bValue == null) return -1;
        
        // Специальная обработка для дат
        if (sortConfig.key === 'date') {
          const aDate = new Date(aValue);
          const bDate = new Date(bValue);
          return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate;
        }
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filteredData;
  }, [searchTerm, chatsData]);

  const columns = [
    { id: 'id', title: 'ID', type: COLUMN_TYPES.NUMBER, width: 80 },
    { id: 'title', title: 'Заголовок чата', type: COLUMN_TYPES.TEXT, minWidth: 200 },
    { id: 'contact', title: 'Контакт', type: COLUMN_TYPES.TEXT, width: 150 },
    { 
      id: 'ticketLink', 
      title: 'Ссылка на заявку', 
      type: COLUMN_TYPES.TEXT, 
      width: 150
    },
    { 
      id: 'type', 
      title: 'Тип', 
      type: COLUMN_TYPES.STATUS, 
      width: 120,
      statusConfig: {
        useful: { label: 'Полезный', variant: 'default' },
        useless: { label: 'Бесполезный', variant: 'destructive' }
      }
    },
    { id: 'date', title: 'Дата', type: COLUMN_TYPES.DATE, width: 120 },
    { 
      id: 'actions', 
      title: 'Действия', 
      type: COLUMN_TYPES.ACTIONS, 
      width: 80,
      sortable: false,
      actions: [
        { id: 'view', label: 'Просмотр', icon: Eye },
        { id: 'edit', label: 'Редактировать', icon: Edit3 },
        { id: 'delete', label: 'Удалить', icon: Trash2, variant: 'danger' }
      ]
    }
  ];

  const bulkActions = [
    { id: 'delete', label: 'Удалить выбранные', icon: Trash2, variant: 'danger' },
    { id: 'archive', label: 'Архивировать', icon: Archive }
  ];

  const handleRowAction = (actionId, rowData) => {
    console.log('Row action:', actionId, rowData);
    alert(`Действие "${actionId}" для: ${rowData.title}`);
  };

  const handleBulkAction = (actionId, selectedData) => {
    console.log('Bulk action:', actionId, selectedData);
    alert(`Групповое действие "${actionId}" для ${selectedData.length} элементов`);
  };


  
  return (
    <div className="h-screen flex flex-col">
   
      
      <div className="flex-1">
        <UniversalDataTable
          columns={columns}
          dataProvider={dataProvider}
          bulkActions={bulkActions}
          onRowAction={handleRowAction}
          onBulkAction={handleBulkAction}
          sideMenuTitle="Операции с чатами"
          emptyMessage="Чаты не найдены по вашему запросу"
          loading={loading}
        />
      </div>

      
    </div>
  );
}

export default Chats;