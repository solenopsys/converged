"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  CheckSquare,
  ChevronDown as MenuIcon,
  Square,
} from "lucide-react";
import {
  DropdownMenu as ShadDropdown,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../dropdown-menu";
import { useUnit } from "effector-react";
import { cn } from "../../../lib/utils";
import {
  $tableColumnsState,
  setColumnWidths,
  setColumnWidthAtIndex,
} from "../../../stores/tableColumnsStore";
import { CellRenderer } from "./CellRenderer";
import { ColumnResizer } from "./ColumnResizer";
import { DefaultRowCard } from "./DefaultRowCard";
import {
  normalizeBoolean,
  normalizeBulkActions,
  normalizeColumns,
  normalizeNumber,
  normalizeRows,
  normalizeViewMode,
  resolveFallbackColumnWidths,
  resolveInitialColumnWidths,
} from "./InfiniteScrollDataTable.helpers";
import type {
  InfiniteScrollDataTableProps,
  RowCardProps,
  RowId,
  TableRowBase,
  ViewMode,
} from "./InfiniteScrollDataTable.types";
import { getRowId, getRowValue, hasRowId } from "./row-utils";

export type {
  BulkAction,
  ColumnAction,
  ColumnConfig,
  InfiniteScrollDataTableProps,
  RowActionHandler,
  RowCardProps,
  RowId,
  SortConfig,
  ViewMode,
} from "./InfiniteScrollDataTable.types";

export function InfiniteScrollDataTable<
  TData extends object = TableRowBase,
>({
  columns: columnsInput = [],
  data: dataInput = [],
  hasMore: hasMoreInput = true,
  loading: loadingInput = false,
  loadingMore: loadingMoreInput = false,
  viewMode = "table",
  tableId = "default-table",
  CardComponent = null,
  responsiveBreakpoint: responsiveBreakpointInput = 768,
  onLoadMore,
  onRowAction,
  onRowClick,
  onBulkAction,
  onSelectionChange,
  bulkActions: bulkActionsInput = [],
  selectable: selectableInput = true,
  totalCount: totalCountInput = 0,
  className = "",
  tableClassName = "",
  emptyMessage = "Данные не найдены",
}: InfiniteScrollDataTableProps<TData>) {
  const columns = useMemo(
    () => normalizeColumns<TData>(columnsInput),
    [columnsInput],
  );
  const data = useMemo(() => normalizeRows<TData>(dataInput), [dataInput]);
  const bulkActions = useMemo(
    () => normalizeBulkActions(bulkActionsInput),
    [bulkActionsInput],
  );
  const hasMore = normalizeBoolean(hasMoreInput, true);
  const loading = normalizeBoolean(loadingInput, false);
  const loadingMore = normalizeBoolean(loadingMoreInput, false);
  const selectable = normalizeBoolean(selectableInput, true);
  const responsiveBreakpoint = normalizeNumber(responsiveBreakpointInput, 768);
  const totalCount = normalizeNumber(totalCountInput, 0);
  const initialViewMode = normalizeViewMode(viewMode);
  const [selectedRows, setSelectedRows] = useState<RowId[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [currentViewMode, setCurrentViewMode] = useState<ViewMode>(initialViewMode);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const loadMoreLockRef = useRef<number | null>(null);
  const initKeyRef = useRef<string | null>(null);
  const EffectiveCardComponent = (CardComponent ?? DefaultRowCard) as React.ComponentType<
    RowCardProps<TData>
  >;

  const visibleColumns = useMemo(
    () =>
      columns.filter((column) => currentViewMode === "table" || column.primary),
    [columns, currentViewMode],
  );

  const tableColumnsState = useUnit($tableColumnsState);
  const columnWidths = tableColumnsState.columnWidths[tableId] || [];

  const fallbackColumnWidths = useMemo(() => {
    if (visibleColumns.length === 0) return [];
    return resolveFallbackColumnWidths(visibleColumns);
  }, [visibleColumns]);

  const resolvedColumnWidths = useMemo(() => {
    if (columnWidths.length === visibleColumns.length && columnWidths.length > 0) {
      return columnWidths;
    }

    return fallbackColumnWidths;
  }, [columnWidths, fallbackColumnWidths, visibleColumns.length]);

  useEffect(() => {
    if (visibleColumns.length === 0 || !tableRef.current) return;

    const initKey = `${tableId}:${visibleColumns
      .map((column) => column.id)
      .join("|")}:${selectable ? "1" : "0"}`;
    const shouldInit =
      columnWidths.length === 0 ||
      columnWidths.length !== visibleColumns.length ||
      initKeyRef.current !== initKey;

    if (!shouldInit) return;

    const containerWidth =
      parentRef.current?.clientWidth ??
      tableRef.current.parentElement?.clientWidth ??
      1000;
    const availableWidth = Math.max(containerWidth - (selectable ? 48 : 0), 0);

    setColumnWidths({
      tableId,
      widths: resolveInitialColumnWidths(visibleColumns, availableWidth),
    });
    initKeyRef.current = initKey;
  }, [tableId, visibleColumns, columnWidths.length, selectable]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const shouldUseCards = entry.contentRect.width < responsiveBreakpoint;
        setCurrentViewMode(shouldUseCards ? "cards" : "table");
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [responsiveBreakpoint]);

  const rowVirtualizer = useVirtualizer({
    count: hasMore ? data.length + 1 : data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (currentViewMode === "table" ? 53 : 140),
    overscan: 5,
  });

  const maybeLoadMore = useCallback(() => {
    const parentElement = parentRef.current;
    if (!parentElement || !onLoadMore) return;
    if (loading || loadingMore || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = parentElement;
    const remaining = scrollHeight - scrollTop - clientHeight;
    const threshold = 200;
    const isScrollable = scrollHeight > clientHeight + 1;

    if (isScrollable && remaining > threshold) return;
    if (loadMoreLockRef.current === data.length) return;

    loadMoreLockRef.current = data.length;
    onLoadMore();
  }, [data.length, hasMore, loading, loadingMore, onLoadMore]);

  useEffect(() => {
    const parentElement = parentRef.current;
    if (!parentElement) return;

    const handleScroll = () => {
      maybeLoadMore();
    };

    parentElement.addEventListener("scroll", handleScroll, { passive: true });
    return () => parentElement.removeEventListener("scroll", handleScroll);
  }, [maybeLoadMore, currentViewMode]);

  useEffect(() => {
    if (loadMoreLockRef.current === data.length) {
      loadMoreLockRef.current = null;
    }

    maybeLoadMore();
  }, [data.length, maybeLoadMore]);

  const handleColumnResize = useCallback(
    (columnIndex: number, nextWidth: number) => {
      const column = visibleColumns[columnIndex];
      const minWidth = column?.minWidth ?? 50;
      const maxWidth = column?.maxWidth ?? Number.POSITIVE_INFINITY;
      const width = Math.min(Math.max(nextWidth, minWidth), maxWidth);
      setColumnWidthAtIndex({ tableId, index: columnIndex, width });
    },
    [visibleColumns, tableId],
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      const nextSelection = checked
        ? data.map((row, index) => getRowId(row, index))
        : [];

      setSelectedRows(nextSelection);
      onSelectionChange?.(nextSelection, checked ? data : []);
    },
    [data, onSelectionChange],
  );

  const handleSelectRow = useCallback(
    (rowId: RowId, checked: boolean) => {
      const nextSelection = checked
        ? [...selectedRows, rowId]
        : selectedRows.filter((id) => id !== rowId);

      setSelectedRows(nextSelection);
      const selectedData = data.filter((row, index) =>
        hasRowId(nextSelection, row, index),
      );
      onSelectionChange?.(nextSelection, selectedData);
    },
    [selectedRows, data, onSelectionChange],
  );

  const handleBulkActionClick = useCallback(
    (actionId: string, selectedIds: RowId[]) => {
      const selectedData = data.filter((row, index) =>
        hasRowId(selectedIds, row, index),
      );
      onBulkAction?.(actionId, selectedData, selectedIds);
      setSelectedRows([]);
    },
    [onBulkAction, data],
  );

  const clearSelection = useCallback(() => {
    setSelectedRows([]);
    onSelectionChange?.([], []);
  }, [onSelectionChange]);

  const isAllSelected = selectedRows.length === data.length && data.length > 0;
  const isIndeterminate = selectedRows.length > 0 && selectedRows.length < data.length;

  const renderCards = () => {
    const virtualItems = rowVirtualizer.getVirtualItems();

    return (
      <div
        ref={parentRef}
        className="h-full min-h-0 flex-1 overflow-auto"
        style={{ contain: "strict" }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
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
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="flex items-center justify-center p-4"
                >
                  {loadingMore && (
                    <p className="text-sm text-muted-foreground">Загрузка...</p>
                  )}
                </div>
              ) : null;
            }

            if (!row) return null;

            const rowId = getRowId(row, virtualRow.index);
            const isSelected = selectedRows.includes(rowId);

            return (
              <div
                key={rowId}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                <div className={cn("relative p-2", isSelected && "ring-2 ring-primary")}>
                  <EffectiveCardComponent
                    data={row}
                    columns={columns}
                    onAction={onRowAction}
                  />
                  {selectable && selectionMode && (
                    <div className="absolute bottom-4 left-4 z-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          handleSelectRow(rowId, event.target.checked)
                        }
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

  const renderTable = () => {
    const virtualItems = rowVirtualizer.getVirtualItems();

    return (
      <div
        ref={parentRef}
        className={cn(
          "h-full min-h-0 flex-1 overflow-auto bg-background",
          tableClassName,
        )}
      >
        <div ref={tableRef} className="w-full">
          <div className="sticky top-0 z-10 flex h-10 border-b bg-background/90">
            {selectable && selectionMode && (
              <div
                className="flex items-center pl-2 font-medium text-muted-foreground"
                style={{ width: "48px", flexShrink: 0 }}
              >
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isIndeterminate;
                  }}
                  onChange={(event) => handleSelectAll(event.target.checked)}
                  className="h-4 w-4 rounded border-input bg-background"
                />
              </div>
            )}

            {visibleColumns.map((column, index) => {
              const width = resolvedColumnWidths[index] ?? 150;
              return (
                <div
                  key={column.id}
                  className="relative flex items-center px-2 text-sm font-medium text-muted-foreground"
                  style={{ width: `${width}px`, flexShrink: 0 }}
                >
                  <span className="block truncate overflow-hidden text-ellipsis whitespace-nowrap">
                    {column.title}
                  </span>

                  {column.resizable !== false && currentViewMode === "table" && (
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

          <div
            style={{
              position: "relative",
              height: `${rowVirtualizer.getTotalSize()}px`,
            }}
          >
            {virtualItems.map((virtualRow) => {
              const isLoaderRow = virtualRow.index > data.length - 1;
              const row = data[virtualRow.index];

              if (isLoaderRow) {
                return hasMore ? (
                  <div
                    key="loader"
                    className="flex items-center justify-center p-4"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {loadingMore && (
                      <p className="text-sm text-muted-foreground">Загрузка...</p>
                    )}
                  </div>
                ) : null;
              }

              if (!row) return null;

              const rowId = getRowId(row, virtualRow.index);
              const isSelected = selectedRows.includes(rowId);

              return (
                <div
                  key={rowId}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className={cn(
                    "flex cursor-pointer border-b transition-colors hover:bg-muted/50",
                    isSelected && "bg-muted",
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {selectable && selectionMode && (
                    <div
                      className="flex items-center py-3 pl-2"
                      style={{ width: "48px", flexShrink: 0 }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          handleSelectRow(rowId, event.target.checked)
                        }
                        className="h-4 w-4 rounded border-input bg-background"
                      />
                    </div>
                  )}

                  {visibleColumns.map((column, index) => {
                    const width = resolvedColumnWidths[index] ?? 150;
                    return (
                      <div
                        key={column.id}
                        className="flex items-center overflow-hidden px-2 py-3"
                        style={{ width: `${width}px`, flexShrink: 0 }}
                      >
                        <div className="w-full overflow-hidden text-ellipsis whitespace-nowrap">
                          <CellRenderer
                            value={getRowValue(row, column.id)}
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
    <div
      ref={containerRef}
      className={cn(
        "relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-background",
        className,
      )}
    >
      {selectedRows.length > 0 && (
        <div className="flex flex-shrink-0 items-center justify-between border-b bg-muted px-6 py-3">
          <span className="text-sm font-medium">
            Выбрано: {selectedRows.length} из {data.length}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={clearSelection}
              className="text-sm font-medium text-primary hover:text-primary/80"
            >
              Снять выделение
            </button>
            {bulkActions.length > 0 && (
              <ShadDropdown>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Операции
                    <MenuIcon size={14} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {bulkActions.map((action) => (
                    <DropdownMenuItem
                      key={action.id}
                      onClick={() => handleBulkActionClick(action.id, selectedRows)}
                      className={cn(
                        action.variant === "destructive" &&
                          "text-destructive focus:text-destructive",
                      )}
                    >
                      {action.icon && <action.icon size={14} className="mr-2" />}
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </ShadDropdown>
            )}
          </div>
        </div>
      )}

      {data.length > 0 && (
        <div className="flex shrink-0 items-center justify-between border-b bg-muted/20 px-3 py-1 text-xs text-muted-foreground">
          {selectable ? (
            <button
              type="button"
              onClick={() => {
                setSelectionMode((value) => !value);
                if (selectionMode) clearSelection();
              }}
              className={cn(
                "flex items-center gap-1.5 transition-colors hover:text-foreground",
                selectionMode && "text-primary",
              )}
            >
              {selectionMode ? <CheckSquare size={13} /> : <Square size={13} />}
              Выбрать
            </button>
          ) : (
            <span />
          )}
          <span>
            {(() => {
              const visibleItems = rowVirtualizer
                .getVirtualItems()
                .filter((item) => item.index < data.length);
              const lastVisible = visibleItems[visibleItems.length - 1];
              const position = lastVisible ? lastVisible.index + 1 : data.length;
              const total = totalCount > 0 ? totalCount : data.length;
              return `${position} / ${total}`;
            })()}
          </span>
        </div>
      )}

      {loading && data.length === 0 ? (
        <div className="flex h-24 w-full items-center justify-center">
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-24 w-full items-center justify-center">
          <p className="text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : currentViewMode === "table" ? (
        renderTable()
      ) : (
        renderCards()
      )}
    </div>
  );
}
