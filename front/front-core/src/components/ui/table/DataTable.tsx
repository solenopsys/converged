"use client";

import * as React from "react";
import {
  type ColumnDef,
  type Row,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from "@tabler/icons-react";
import { cn } from "../../../lib/utils";
import { Button } from "../button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../table";

export type DataTableColumnMeta = {
  mobileLabel?: string;
  mobileHidden?: boolean;
  mobileOrder?: number;
  mobilePrimary?: boolean;
};

export type DataTableColumnDef<TData> = ColumnDef<TData, unknown> & {
  meta?: DataTableColumnMeta;
};

export interface DataTableProps<TData> {
  data: TData[];
  columns: DataTableColumnDef<TData>[];
  totalCount?: number;
  pageIndex?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageChange?: (pageIndex: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  getRowId?: (originalRow: TData, index: number) => string;
  onRowClick?: (row: TData) => void;
  className?: string;
  tableClassName?: string;
  mobileCardClassName?: string;
  emptyMessage?: string;
}

function defaultRowId(_row: unknown, index: number) {
  return String(index);
}

function getColumnMeta(meta: unknown): DataTableColumnMeta {
  return (meta ?? {}) as DataTableColumnMeta;
}

function getHeaderLabel<TData>(row: Row<TData>, columnId: string): string {
  const column = row.getAllCells().find((cell) => cell.column.id === columnId)?.column;
  const header = column?.columnDef?.header;
  if (typeof header === "string") {
    return header;
  }
  const meta = getColumnMeta(column?.columnDef?.meta);
  return meta.mobileLabel ?? columnId;
}

function sortMobileCells<TData>(row: Row<TData>) {
  return row
    .getVisibleCells()
    .filter((cell) => !getColumnMeta(cell.column.columnDef.meta).mobileHidden)
    .sort((a, b) => {
      const aPrimary = getColumnMeta(a.column.columnDef.meta).mobilePrimary ? 1 : 0;
      const bPrimary = getColumnMeta(b.column.columnDef.meta).mobilePrimary ? 1 : 0;
      if (aPrimary !== bPrimary) return bPrimary - aPrimary;

      const aOrder = getColumnMeta(a.column.columnDef.meta).mobileOrder ?? Number.MAX_SAFE_INTEGER;
      const bOrder = getColumnMeta(b.column.columnDef.meta).mobileOrder ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });
}

export function DataTable<TData>({
  data,
  columns,
  totalCount,
  pageIndex: controlledPageIndex,
  pageSize: controlledPageSize,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
  getRowId = defaultRowId as (originalRow: TData, index: number) => string,
  onRowClick,
  className,
  tableClassName,
  mobileCardClassName,
  emptyMessage = "No results",
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [internalPagination, setInternalPagination] = React.useState({
    pageIndex: 0,
    pageSize: pageSizeOptions[0] ?? 10,
  });

  const pageIndex = controlledPageIndex ?? internalPagination.pageIndex;
  const pageSize = controlledPageSize ?? internalPagination.pageSize;
  const isControlledPagination =
    controlledPageIndex != null &&
    controlledPageSize != null &&
    typeof onPageChange === "function" &&
    typeof onPageSizeChange === "function";

  const effectiveTotalCount = totalCount ?? data.length;
  const pageCount = Math.max(1, Math.ceil(effectiveTotalCount / Math.max(pageSize, 1)));

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination: { pageIndex, pageSize },
    },
    manualPagination: isControlledPagination,
    pageCount: isControlledPagination ? pageCount : undefined,
    onSortingChange: setSorting,
    onPaginationChange: (next) => {
      const value =
        typeof next === "function" ? next({ pageIndex, pageSize }) : next;

      if (isControlledPagination) {
        onPageChange?.(value.pageIndex);
        onPageSizeChange?.(value.pageSize);
        return;
      }

      setInternalPagination(value);
    },
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;
  const currentPage = table.getState().pagination.pageIndex + 1;
  const canPrevious = table.getCanPreviousPage();
  const canNext = table.getCanNextPage();

  const renderDesktopTable = () => (
    <div className="hidden md:block">
      <div className={cn("overflow-hidden rounded-lg border", tableClassName)}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={onRowClick ? "cursor-pointer" : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const renderMobileCards = () => (
    <div className="space-y-3 md:hidden">
      {rows.length > 0 ? (
        rows.map((row) => {
          const mobileCells = sortMobileCells(row);
          const primaryCell = mobileCells[0];
          const details = mobileCells.slice(1);

          return (
            <article
              key={row.id}
              className={cn(
                "rounded-lg border bg-card p-3",
                onRowClick ? "cursor-pointer active:opacity-80" : undefined,
                mobileCardClassName,
              )}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
            >
              {primaryCell ? (
                <div className="mb-2 text-sm font-semibold leading-snug break-words">
                  {flexRender(primaryCell.column.columnDef.cell, primaryCell.getContext())}
                </div>
              ) : null}

              <div className="space-y-1.5">
                {details.map((cell) => (
                  <div key={cell.id} className="grid grid-cols-[minmax(90px,max-content)_1fr] gap-2 text-xs">
                    <div className="text-muted-foreground truncate">
                      {getColumnMeta(cell.column.columnDef.meta).mobileLabel ??
                        getHeaderLabel(row, cell.column.id)}
                    </div>
                    <div className="min-w-0 break-words">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          );
        })
      ) : (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      )}
    </div>
  );

  return (
    <section className={cn("space-y-4", className)}>
      {renderDesktopTable()}
      {renderMobileCards()}

      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Page {currentPage} of {pageCount}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={String(pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-[88px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.setPageIndex(0)}
            disabled={!canPrevious}
            aria-label="First page"
          >
            <IconChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.previousPage()}
            disabled={!canPrevious}
            aria-label="Previous page"
          >
            <IconChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.nextPage()}
            disabled={!canNext}
            aria-label="Next page"
          >
            <IconChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!canNext}
            aria-label="Last page"
          >
            <IconChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
