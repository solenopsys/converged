"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Check, X, ChevronDown, ChevronUp, MoreHorizontal, Settings, GripVertical } from 'lucide-react';
import { useUnit } from 'effector-react';
import { cn } from '../../../lib/utils';
import { SideMenu } from "../SideMenu";
import { COLUMN_TYPES } from "./constants";
import {
  $tableColumnsState,
  setColumnWidths,
  setColumnWidthAtIndex,
  getTableColumnWidths
} from '../../../stores/tableColumnsStore';

// Режимы отображения
export type ViewMode = 'table' | 'cards';

// Интерфейс колонки
export interface ColumnConfig {
  id: string;
  title: string;
  type: string;
  width?: string | number;
  minWidth?: number;
  maxWidth?: number;
  sortable?: boolean;
  primary?: boolean; // Главная колонка для mobile
  resizable?: boolean; // Можно ли изменять размер
  render?: (value: any, rowData: any, onAction?: (actionId: string, rowData: any) => void) => React.ReactNode;
  statusConfig?: Record<string, { label: string; variant?: string; className?: string }>;
  actions?: Array<{
    id: string;
    label: string;
    icon?: React.ComponentType<any>;
    onClick?: () => void;
    disabled?: boolean;
    variant?: 'default' | 'danger';
  }>;
}

// Компонент для изменения размера колонки
const ColumnResizer = ({
  onResize,
  currentWidth,
  columnIndex
}: {
  onResize: (columnIndex: number, nextWidth: number) => void;
  currentWidth: number;
  columnIndex: number;
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const latestXRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const targetElement = e.currentTarget;
    targetElement.setPointerCapture(e.pointerId);

    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = currentWidth;
    latestXRef.current = e.clientX;
    pointerIdRef.current = e.pointerId;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      latestXRef.current = moveEvent.clientX;

      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(() => {
          const deltaX = latestXRef.current - startXRef.current;
          onResize(columnIndex, startWidthRef.current + deltaX);
          animationFrameRef.current = null;
        });
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);

      const deltaX = latestXRef.current - startXRef.current;
      onResize(columnIndex, startWidthRef.current + deltaX);

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (pointerIdRef.current !== null && targetElement) {
        targetElement.releasePointerCapture(pointerIdRef.current);
        pointerIdRef.current = null;
      }

      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp, { once: true });
  };

  return (
    <div
      className={cn(
        "absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none group/resizer hover:bg-primary/20",
        isDragging && "bg-primary/50"
      )}
      onPointerDown={handlePointerDown}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/resizer:opacity-100 transition-opacity pointer-events-none">
        <GripVertical size={14} className="text-primary" />
      </div>
    </div>
  );
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

  if (render && typeof render === 'function') {
    return render(value, rowData, onAction);
  }

  switch (type) {
    case COLUMN_TYPES.TEXT:
      return <div className="text-sm truncate" title={value}>{value}</div>;

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

      const maxVisible = 2;
      const visibleTags = value.slice(0, maxVisible);
      const hiddenCount = value.length - maxVisible;

      return (
        <div className="flex items-center gap-1" title={value.join(', ')}>
          {visibleTags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground whitespace-nowrap"
            >
              {tag}
            </span>
          ))}
          {hiddenCount > 0 && (
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground whitespace-nowrap cursor-help">
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

// Основной компонент таблицы с TanStack Virtual
export const InfiniteScrollDataTable = ({
  columns = [],
  data = [],
  hasMore = true,
  loading = false,
  loadingMore = false,
  viewMode = 'table' as ViewMode,
  tableId = 'default-table', // Уникальный ID таблицы для сохранения состояния
  CardComponent = null,
  responsiveBreakpoint = 768, // Ширина в px, при которой переключаемся на карточки
  onLoadMore,
  onSort,
  onRowAction,
  onRowClick,
  onBulkAction,
  onSelectionChange,
  bulkActions = [],
  selectable = true,
  sortConfig = { key: null, direction: 'asc' },
  sideMenuTitle,
  className = "",
  tableClassName = "",
  emptyMessage = "Данные не найдены",
}) => {
  const [selectedRows, setSelectedRows] = useState([]);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [currentViewMode, setCurrentViewMode] = useState<ViewMode>(viewMode);
  const containerRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const loadMoreLockRef = useRef<number | null>(null);
  const initKeyRef = useRef<string | null>(null);

  const visibleColumns = useMemo(
    () => columns.filter(col => currentViewMode === 'table' || col.primary),
    [columns, currentViewMode]
  );

  // Получаем состояние колонок из Effector - массив ширин
  const tableColumnsState = useUnit($tableColumnsState);
  const columnWidths = tableColumnsState.columnWidths[tableId] || [];

  const fallbackColumnWidths = useMemo(() => {
    if (visibleColumns.length === 0) {
      return [];
    }

    return visibleColumns.map((col) => {
      let width: number | undefined;

      if (typeof col.width === 'number') {
        width = col.width;
      } else if (typeof col.width === 'string' && col.width.endsWith('px')) {
        const parsed = parseInt(col.width, 10);
        width = Number.isNaN(parsed) ? undefined : parsed;
      }

      if (width == null) {
        width = col.minWidth ?? (col.primary ? 300 : 150);
      }

      const minWidth = col.minWidth ?? 50;
      const maxWidth = col.maxWidth ?? Number.POSITIVE_INFINITY;
      return Math.min(Math.max(width, minWidth), maxWidth);
    });
  }, [visibleColumns]);

  const resolvedColumnWidths = useMemo(() => {
    if (columnWidths.length === visibleColumns.length && columnWidths.length > 0) {
      return columnWidths;
    }

    return fallbackColumnWidths;
  }, [columnWidths, fallbackColumnWidths, visibleColumns.length]);

  // Инициализация ширин колонок при монтировании
  useEffect(() => {
    if (visibleColumns.length === 0 || !tableRef.current) {
      return;
    }

    const initKey = `${tableId}:${visibleColumns.map(col => col.id).join('|')}:${selectable ? '1' : '0'}`;
    const shouldInit =
      columnWidths.length === 0 ||
      columnWidths.length !== visibleColumns.length ||
      initKeyRef.current !== initKey;

    if (!shouldInit) {
      return;
    }

    const containerWidth = parentRef.current?.clientWidth
      || tableRef.current.parentElement?.clientWidth
      || 1000;
    const availableWidth = Math.max(containerWidth - (selectable ? 48 : 0), 0);

    const parseWidth = (value: string | number | undefined) => {
      if (typeof value === 'number') {
        return value;
      }
      if (typeof value === 'string' && value.endsWith('px')) {
        const parsed = parseInt(value, 10);
        return Number.isNaN(parsed) ? undefined : parsed;
      }
      return undefined;
    };

    const minWidths = visibleColumns.map(col => col.minWidth ?? 50);
    const maxWidths = visibleColumns.map(col => col.maxWidth ?? Number.POSITIVE_INFINITY);
    const explicitWidths = visibleColumns.map(col => parseWidth(col.width));

    let widths = visibleColumns.map((col, index) => {
      const base =
        explicitWidths[index]
        ?? col.minWidth
        ?? (col.primary ? 300 : 150);
      return Math.min(Math.max(base, minWidths[index]), maxWidths[index]);
    });

    const totalWidth = widths.reduce((sum, w) => sum + w, 0);
    const hasExplicitWidths = explicitWidths.some(width => width != null);
    if (!hasExplicitWidths && availableWidth > 0 && totalWidth < availableWidth) {
      let remaining = availableWidth - totalWidth;
      const extraPer = remaining / widths.length;

      widths = widths.map((width, index) => {
        const isLast = index === widths.length - 1;
        const extra = isLast ? remaining : extraPer;
        const nextWidth = Math.min(maxWidths[index], width + extra);
        remaining -= nextWidth - width;
        return nextWidth;
      });
    }

    setColumnWidths({
      tableId,
      widths: widths.map(width => Math.round(width)),
    });
    initKeyRef.current = initKey;
  }, [tableId, visibleColumns, columnWidths.length, selectable]);

  // Определение режима отображения на основе ширины контейнера
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const shouldUseCards = width < responsiveBreakpoint;

        setCurrentViewMode(shouldUseCards ? 'cards' : 'table');
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [responsiveBreakpoint]);

  // TanStack Virtual для виртуализации строк
  const rowVirtualizer = useVirtualizer({
    count: hasMore ? data.length + 1 : data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => currentViewMode === 'table' ? 53 : 120, // высота строки таблицы или карточки
    overscan: 5,
  });

  const maybeLoadMore = useCallback(() => {
    const parentElement = parentRef.current;
    if (!parentElement || !onLoadMore) {
      return;
    }

    if (loading || loadingMore || !hasMore) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = parentElement;
    const remaining = scrollHeight - scrollTop - clientHeight;
    const threshold = 200;
    const isScrollable = scrollHeight > clientHeight + 1;

    if (!isScrollable || remaining > threshold) {
      return;
    }

    if (loadMoreLockRef.current === data.length) {
      return;
    }

    loadMoreLockRef.current = data.length;
    onLoadMore();
  }, [data.length, hasMore, loading, loadingMore, onLoadMore]);

  useEffect(() => {
    const parentElement = parentRef.current;
    if (!parentElement) {
      return;
    }

    const handleScroll = () => {
      maybeLoadMore();
    };

    parentElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => parentElement.removeEventListener('scroll', handleScroll);
  }, [maybeLoadMore, viewMode]);

  useEffect(() => {
    if (loadMoreLockRef.current === data.length) {
      loadMoreLockRef.current = null;
    }
  }, [data.length]);

  // Обработчик изменения размера колонки
  const handleColumnResize = useCallback((columnIndex: number, nextWidth: number) => {
    const column = visibleColumns[columnIndex];
    const minWidth = column?.minWidth ?? 50;
    const maxWidth = column?.maxWidth ?? Number.POSITIVE_INFINITY;

    const newWidth = Math.min(Math.max(nextWidth, minWidth), maxWidth);
    setColumnWidthAtIndex({ tableId, index: columnIndex, width: newWidth });
  }, [columnWidths, visibleColumns, tableId]);

  const handleSelectAll = useCallback((checked) => {
    const newSelection = checked ? data.map((item, index) => item.id || index) : [];
    setSelectedRows(newSelection);

    if (onSelectionChange) {
      const selectedData = checked ? data : [];
      onSelectionChange(newSelection, selectedData);
    }
  }, [data, onSelectionChange]);

  const handleSelectRow = useCallback((rowId, checked) => {
    const newSelection = checked
      ? [...selectedRows, rowId]
      : selectedRows.filter(id => id !== rowId);

    setSelectedRows(newSelection);

    if (onSelectionChange) {
      const selectedData = data.filter((item, index) =>
        newSelection.includes(item.id || index)
      );
      onSelectionChange(newSelection, selectedData);
    }
  }, [selectedRows, data, onSelectionChange]);

  const handleBulkActionClick = useCallback((actionId, selectedIds) => {
    if (onBulkAction) {
      const selectedData = data.filter((item, index) =>
        selectedIds.includes(item.id || index)
      );
      onBulkAction(actionId, selectedData, selectedIds);
    }
    setSelectedRows([]);
    setSideMenuOpen(false);
  }, [onBulkAction, data]);

  const isAllSelected = selectedRows.length === data.length && data.length > 0;
  const isIndeterminate = selectedRows.length > 0 && selectedRows.length < data.length;

  // Рендер карточек для mobile
  const renderCards = () => {
    if (!CardComponent) {
      return (
        <div className="p-4 text-center text-muted-foreground">
          CardComponent не указан
        </div>
      );
    }

    const virtualItems = rowVirtualizer.getVirtualItems();

    return (
      <div
        ref={parentRef}
        className="h-full flex-1 min-h-0 overflow-auto"
        style={{ contain: 'strict' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualRow) => {
            const isLoaderRow = virtualRow.index > data.length - 1;
            const row = data[virtualRow.index];

            if (isLoaderRow) {
              return hasMore ? (
                <div
                  key="loader"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="flex items-center justify-center p-4"
                >
                  {loadingMore && <p className="text-sm text-muted-foreground">Загрузка...</p>}
                </div>
              ) : null;
            }

            const rowId = row.id || virtualRow.index;
            const isSelected = selectedRows.includes(rowId);

            return (
              <div
                key={rowId}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                <div className={cn("p-2 relative", isSelected && "ring-2 ring-primary")}>
                  <CardComponent data={row} columns={columns} onAction={onRowAction} />
                  {selectable && (
                    <div className="absolute bottom-4 left-4 z-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectRow(rowId, e.target.checked);
                        }}
                        className="h-4 w-4 rounded border-input bg-background"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Рендер таблицы
  const renderTable = () => {
    const virtualItems = rowVirtualizer.getVirtualItems();
    return (
      <div
        ref={parentRef}
        className={cn("h-full flex-1 overflow-auto min-h-0 bg-background", tableClassName)}
      >
        <div ref={tableRef} className="w-full">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background/90 border-b flex h-10">
            {selectable && (
              <div
                className="pl-2 flex items-center font-medium text-muted-foreground"
                style={{ width: '48px', flexShrink: 0 }}
              >
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={input => {
                    if (input) input.indeterminate = isIndeterminate;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="h-4 w-4 rounded border-input bg-background"
                />
              </div>
            )}

            {visibleColumns.map((column, index) => {
              const width = resolvedColumnWidths[index] ?? 150;
              return (
                <div
                  key={column.id}
                  className="px-2 flex items-center font-medium text-muted-foreground relative text-sm"
                  style={{ width: `${width}px`, flexShrink: 0 }}
                >
                  <span className="truncate block overflow-hidden text-ellipsis whitespace-nowrap">{column.title}</span>

                  {column.resizable !== false && currentViewMode === 'table' && (
                    <ColumnResizer
                      columnIndex={index}
                      currentWidth={width}
                      onResize={handleColumnResize}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Body */}
          <div style={{ position: 'relative', height: `${rowVirtualizer.getTotalSize()}px` }}>
            {virtualItems.map((virtualRow) => {
              const isLoaderRow = virtualRow.index > data.length - 1;
              const row = data[virtualRow.index];

              if (isLoaderRow) {
                return hasMore ? (
                  <div
                    key="loader"
                    className="flex items-center justify-center p-4"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {loadingMore && <p className="text-sm text-muted-foreground">Загрузка...</p>}
                  </div>
                ) : null;
              }

              const rowId = row.id || virtualRow.index;
              const isSelected = selectedRows.includes(rowId);

              return (
                <div
                  key={rowId}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className={cn(
                    "border-b transition-colors hover:bg-muted/50 cursor-pointer flex",
                    isSelected && "bg-muted"
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {selectable && (
                    <div
                      className="py-3 pl-2 flex items-center"
                      style={{ width: '48px', flexShrink: 0 }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectRow(rowId, e.target.checked);
                        }}
                        className="h-4 w-4 rounded border-input bg-background"
                      />
                    </div>
                  )}

                  {visibleColumns.map((column, index) => {
                    const width = resolvedColumnWidths[index] ?? 150;
                    return (
                      <div
                        key={column.id}
                        className="py-3 px-2 flex items-center overflow-hidden"
                        style={{ width: `${width}px`, flexShrink: 0 }}
                      >
                        <div className="overflow-hidden text-ellipsis whitespace-nowrap w-full">
                          <CellRenderer
                            value={row[column.id]}
                            column={column}
                            rowData={row}
                            onAction={onRowAction}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className={cn("w-full h-full min-h-0 bg-background relative flex flex-col overflow-hidden", className)}>
      {/* Selection bar */}
      {selectedRows.length > 0 && (
        <div className="px-6 py-3 bg-muted border-b flex items-center justify-between flex-shrink-0">
          <span className="text-sm font-medium">
            Выбрано: {selectedRows.length} из {data.length}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedRows([]);
                onSelectionChange?.([], []);
              }}
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

      {/* Content */}
      {loading && data.length === 0 ? (
        <div className="flex h-24 w-full items-center justify-center">
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-24 w-full items-center justify-center">
          <p className="text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <>
          {currentViewMode === 'table' ? renderTable() : renderCards()}
        </>
      )}

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
