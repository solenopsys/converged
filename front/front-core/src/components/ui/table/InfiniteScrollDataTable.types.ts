import type React from "react";
import type { ColumnType } from "./constants";

export type ViewMode = "table" | "cards";

export type RowId = string | number;

export type TableRowBase = {
  id?: RowId;
};

export type RowActionHandler<TData extends object> = (
  actionId: string,
  rowData: TData,
) => void;

export type TableActionIcon = React.ComponentType<{
  size?: number;
  className?: string;
}>;

export type ColumnAction<TData extends object> = {
  id: string;
  label: string;
  icon?: TableActionIcon;
  onClick?: (rowData: TData) => void;
  disabled?: boolean;
  variant?: "default" | "danger";
};

export type ColumnStatusConfig = Record<
  string,
  { label: string; variant?: string; className?: string }
>;

export interface ColumnConfig<TData extends object = TableRowBase> {
  id: string;
  title: string;
  type: ColumnType | string;
  width?: string | number;
  minWidth?: number;
  maxWidth?: number;
  sortable?: boolean;
  primary?: boolean;
  cardPrimary?: boolean;
  cardVisible?: boolean;
  cardOrder?: number;
  resizable?: boolean;
  render?: (
    value: unknown,
    rowData: TData,
    onAction?: RowActionHandler<TData>,
  ) => React.ReactNode;
  statusConfig?: ColumnStatusConfig;
  actions?: Array<ColumnAction<TData>>;
}

export type BulkAction = {
  id: string;
  label: string;
  icon?: TableActionIcon;
  variant?: "default" | "danger" | "destructive";
};

export type SortConfig = {
  key: string | null;
  direction: "asc" | "desc";
};

export type RowCardProps<TData extends object = TableRowBase> = {
  data: TData;
  columns: Array<ColumnConfig<TData>>;
  onAction?: RowActionHandler<TData>;
};

export interface InfiniteScrollDataTableProps<TData extends object = TableRowBase> {
  columns?: Array<ColumnConfig<TData>> | unknown;
  data?: TData[] | unknown;
  hasMore?: unknown;
  loading?: unknown;
  loadingMore?: unknown;
  viewMode?: ViewMode | string;
  tableId?: string;
  CardComponent?:
    | React.ComponentType<RowCardProps<TData>>
    | React.ComponentType<Record<string, unknown>>
    | null;
  responsiveBreakpoint?: unknown;
  onLoadMore?: () => void;
  onSort?:
    | ((config: SortConfig) => void)
    | ((columnId: string, direction: SortConfig["direction"]) => void);
  onRowAction?: RowActionHandler<TData>;
  onRowClick?: (rowData: TData) => void;
  onBulkAction?: (actionId: string, rows: TData[], rowIds: RowId[]) => void;
  onSelectionChange?: (rowIds: RowId[], rows: TData[]) => void;
  bulkActions?: BulkAction[] | unknown;
  selectable?: unknown;
  totalCount?: unknown;
  sortConfig?: SortConfig | unknown;
  sideMenuTitle?: string;
  className?: string;
  tableClassName?: string;
  emptyMessage?: string;
}
