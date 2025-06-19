import React, { useState, useMemo, useCallback } from 'react';
import { Check, X, ChevronDown, ChevronUp, MoreHorizontal, Settings, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

// Типы колонок
export const COLUMN_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
  BOOLEAN: 'boolean',
  STATUS: 'status',
  TAGS: 'tags',
  IMAGE: 'image',
  LINK: 'link',
  ACTIONS: 'actions',
  CUSTOM: 'custom'
};

// Компонент выпадающего меню
const DropdownMenu = ({ trigger, children, align = 'right' }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className={`absolute top-full mt-1 w-48 bg-background border rounded-lg shadow-lg z-20 ${
            align === 'left' ? 'left-0' : 'right-0'
          }`}>
            <div className="py-1">
              {children.map((item, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    item.onClick?.();
                    setIsOpen(false);
                  }}
                  disabled={item.disabled}
                  className={cn(
                    "w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors",
                    "hover:bg-accent focus:bg-accent",
                    item.disabled && "text-muted-foreground cursor-not-allowed hover:bg-transparent",
                    item.variant === 'danger' && !item.disabled && "text-destructive hover:bg-destructive/10"
                  )}
                >
                  {item.icon && <item.icon size={16} />}
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Компонент рендера ячейки
const CellRenderer = ({ value, column, rowData, onAction }) => {
  const { type, render, statusConfig = {}, actions = [] } = column;

  // Кастомный рендер
  if (render && typeof render === 'function') {
    return render(value, rowData, onAction);
  }

  switch (type) {
    case COLUMN_TYPES.TEXT:
      return (
        <div className="text-sm truncate" title={value}>
          {value}
        </div>
      );
    
    case COLUMN_TYPES.NUMBER:
      return (
        <div className="text-sm font-mono tabular-nums">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
      );
    
    case COLUMN_TYPES.DATE:
      return (
        <div className="text-sm text-muted-foreground">
          {value ? new Date(value).toLocaleDateString('ru-RU') : '-'}
        </div>
      );
    
    case COLUMN_TYPES.BOOLEAN:
      return (
        <div className="flex justify-center">
          <div className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center",
            value ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {value ? <Check size={12} /> : <X size={12} />}
          </div>
        </div>
      );
    
    case COLUMN_TYPES.STATUS:
      const config = statusConfig[value] || { label: value, variant: 'secondary' };
      return (
        <span className={cn(
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
          config.variant === 'default' && "bg-primary text-primary-foreground",
          config.variant === 'secondary' && "bg-secondary text-secondary-foreground",
          config.variant === 'destructive' && "bg-destructive text-destructive-foreground",
          config.variant === 'outline' && "text-foreground border border-input bg-background hover:bg-accent hover:text-accent-foreground",
          !config.variant && "bg-secondary text-secondary-foreground",
          config.className
        )}>
          {config.label}
        </span>
      );
    
    case COLUMN_TYPES.TAGS:
      if (!Array.isArray(value) || value.length === 0) {
        return <span className="text-muted-foreground text-sm">-</span>;
      }
      
      // Показываем максимум 2-3 тега в зависимости от ширины колонки
      const maxVisible = 2;
      const visibleTags = value.slice(0, maxVisible);
      const hiddenCount = value.length - maxVisible;
      
      return (
        <div 
          className="flex items-center gap-1"
          title={value.join(', ')}
        >
          {visibleTags.map((tag, index) => (
            <span 
              key={index} 
              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground whitespace-nowrap"
            >
              {tag}
            </span>
          ))}
          {hiddenCount > 0 && (
            <span 
              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground whitespace-nowrap cursor-help"
            >
              +{hiddenCount}
            </span>
          )}
        </div>
      );
    
    case COLUMN_TYPES.ACTIONS:
      if (actions.length === 0) return null;
      
      return (
        <DropdownMenu
          trigger={
            <button className={cn(
              "inline-flex items-center justify-center rounded-md text-sm font-medium",
              "h-8 w-8 p-0 hover:bg-accent hover:text-accent-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}>
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Открыть меню</span>
            </button>
          }
          children={actions.map(action => ({
            ...action,
            onClick: () => onAction?.(action.id, rowData)
          }))}
        />
      );
    
    default:
      return <div className="text-sm">{value}</div>;
  }
};

// Боковое меню
const SideMenu = ({ selectedRows, bulkActions, onBulkAction, isOpen, onClose, title = "Операции" }) => {
  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={onClose}
        />
      )}
      
      <div className={`fixed right-0 top-0 h-full w-80 bg-background shadow-xl border-l z-50 transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex items-center justify-between p-4 border-b bg-muted/50">
          <div>
            <h3 className="font-semibold">{title}</h3>
            {selectedRows.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Выбрано: {selectedRows.length}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          <div className="space-y-2">
            {bulkActions.map(action => (
              <button
                key={action.id}
                onClick={() => onBulkAction(action.id, selectedRows)}
                disabled={selectedRows.length === 0}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg border transition-all",
                  selectedRows.length === 0 ? [
                    "bg-muted text-muted-foreground cursor-not-allowed border-border"
                  ] : [
                    "hover:bg-accent border-border",
                    action.variant === 'danger' && "hover:bg-destructive/10 hover:border-destructive/20"
                  ]
                )}
              >
                {action.icon && (
                  <action.icon className={cn(
                    "h-4 w-4",
                    selectedRows.length === 0 ? "text-muted-foreground" : 
                    action.variant === 'danger' ? "text-destructive" : "text-foreground"
                  )} />
                )}
                <span className="text-sm font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

// Основной компонент таблицы
export const UniversalDataTable = ({ 
  columns = [], 
  dataProvider,
  bulkActions = [],
  onRowAction,
  onBulkAction,
  sortable = true,
  selectable = true,
  sideMenuTitle,
  className = "",
  emptyMessage = "Данные не найдены"
}) => {
  const [selectedRows, setSelectedRows] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [sideMenuOpen, setSideMenuOpen] = useState(false);

  // Получение данных только через dataProvider
  const tableData = useMemo(() => {
    if (!dataProvider || typeof dataProvider !== 'function') {
      return [];
    }
    return dataProvider(sortConfig);
  }, [dataProvider, sortConfig]);

  // Обработчики
  const handleSort = useCallback((columnId) => {
    if (!sortable) return;
    
    setSortConfig(prev => ({
      key: columnId,
      direction: prev.key === columnId && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, [sortable]);

  const handleSelectAll = useCallback((checked) => {
    setSelectedRows(checked ? tableData.map((item, index) => item.id || index) : []);
  }, [tableData]);

  const handleSelectRow = useCallback((rowId, checked) => {
    setSelectedRows(prev =>
      checked ? [...prev, rowId] : prev.filter(id => id !== rowId)
    );
  }, []);

  const handleBulkActionClick = useCallback((actionId, selectedIds) => {
    if (onBulkAction) {
      const selectedData = tableData.filter((item, index) => 
        selectedIds.includes(item.id || index)
      );
      onBulkAction(actionId, selectedData, selectedIds);
    }
    setSelectedRows([]);
    setSideMenuOpen(false);
  }, [onBulkAction, tableData]);

  const isAllSelected = selectedRows.length === tableData.length && tableData.length > 0;
  const isIndeterminate = selectedRows.length > 0 && selectedRows.length < tableData.length;

  return (
    <div className={cn("w-full h-full bg-background relative flex flex-col", className)}>
      {/* Selection bar */}
      {selectedRows.length > 0 && (
        <div className="px-6 py-3 bg-muted border-b flex items-center justify-between flex-shrink-0">
          <span className="text-sm font-medium">
            Выбрано: {selectedRows.length} из {tableData.length}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedRows([])}
              className="text-sm text-primary hover:text-primary/80 font-medium"
            >
              Снять выделение
            </button>
            {bulkActions.length > 0 && (
              <button
                onClick={() => setSideMenuOpen(true)}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2 text-sm"
              >
                <Settings size={14} />
                Операции
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse table-fixed">
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-muted/50">
              {selectable && (
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-12">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={input => {
                      if (input) input.indeterminate = isIndeterminate;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-input bg-background data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                  />
                </th>
              )}
              
              {columns.map(column => (
                <th 
                  key={column.id}
                  className="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
                  style={{ 
                    width: column.width || 'auto',
                    minWidth: column.minWidth || 'auto',
                    maxWidth: column.maxWidth || 'auto'
                  }}
                >
                  {column.sortable !== false && sortable ? (
                    <button
                      onClick={() => handleSort(column.id)}
                      className="flex items-center gap-1 hover:text-foreground transition-colors group w-full text-left"
                    >
                      <span className="truncate">{column.title}</span>
                      <div className="flex flex-col ml-auto flex-shrink-0">
                        <ChevronUp 
                          size={12} 
                          className={`-mb-1 transition-colors ${
                            sortConfig.key === column.id && sortConfig.direction === 'asc'
                              ? 'text-foreground' 
                              : 'text-muted-foreground/50 group-hover:text-muted-foreground'
                          }`} 
                        />
                        <ChevronDown 
                          size={12} 
                          className={`transition-colors ${
                            sortConfig.key === column.id && sortConfig.direction === 'desc'
                              ? 'text-foreground' 
                              : 'text-muted-foreground/50 group-hover:text-muted-foreground'
                          }`} 
                        />
                      </div>
                    </button>
                  ) : (
                    <span className="truncate">{column.title}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          
          <tbody className="[&_tr:last-child]:border-0">
            {tableData.map((row, index) => {
              const rowId = row.id || index;
              const isSelected = selectedRows.includes(rowId);
              
              return (
                <tr
                  key={rowId}
                  className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                  data-state={isSelected ? 'selected' : ''}
                >
                  {selectable && (
                    <td className="p-4 align-middle">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectRow(rowId, e.target.checked)}
                        className="h-4 w-4 rounded border-input bg-background data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                      />
                    </td>
                  )}
                  
                  {columns.map(column => (
                    <td key={column.id} className="p-4 align-middle">
                      <CellRenderer
                        value={row[column.id]}
                        column={column}
                        rowData={row}
                        onAction={onRowAction}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {tableData.length === 0 && (
          <div className="flex h-24 w-full items-center justify-center">
            <p className="text-muted-foreground">{emptyMessage}</p>
          </div>
        )}
      </div>

      {/* Side Menu */}
      {bulkActions.length > 0 && (
        <SideMenu
          selectedRows={selectedRows}
          bulkActions={bulkActions}
          onBulkAction={handleBulkActionClick}
          isOpen={sideMenuOpen}
          onClose={() => setSideMenuOpen(false)}
          title={sideMenuTitle}
        />
      )}
    </div>
  );
};

// Компонент заголовка таблицы
export const TableHeader = ({ title, subtitle, children }) => (
  <div className="bg-background border-b">
    <div className="px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {children}
        </div>
      </div>
    </div>
  </div>
);

// Компонент поиска
export const SearchInput = ({ value, onChange, placeholder = "Поиск..." }) => (
  <div className="relative">
    <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="pl-10 pr-4 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
    />
  </div>
);