import type { ComponentChildren, ComponentType } from "preact";
import type { ColumnType } from "./constants";
import type {
	TableFilterConfig,
	TableFilterValues,
} from "./filter-header";

export type ViewMode = "table" | "cards";

export type RowId = string | number;

export type TableRowBase = {
  id?: RowId;
};

export type RowActionHandler<TData extends object> = (
  actionId: string,
  rowData: TData,
) => void;


export type TableActionIcon = ComponentType<{
  size?: number;
  class?: string;
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
  ) => ComponentChildren;
  statusConfig?: ColumnStatusConfig;
  actions?: Array<ColumnAction<TData>>;
}

export type BulkAction = {
  id: string;
  label: string;
  icon?: TableActionIcon;
  variant?: "default" | "danger" | "destructive";
};

/**
 * A command published by the object runtime for the collection on screen. It
 * is not configured on the table: an operation that accepts this kind of
 * reference becomes a command here and a function for the assistant at once.
 */
export type TableCommand = {
  id: string;
  label: string;
  description?: string;
  icon?: TableActionIcon;
  variant?: "default" | "destructive";
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
    | ComponentType<RowCardProps<TData>>
    | ComponentType<Record<string, unknown>>
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
  commands?: TableCommand[];
  onCommand?: (commandId: string, rowIds: RowId[], rows: TData[]) => void;
  /** What the commands apply to while nothing is ticked: the whole selection. */
  commandScopeLabel?: string;
  /** Changing this clears the ticked rows — a command consumed them. */
  selectionResetKey?: string | number;
  selectable?: unknown;
  totalCount?: unknown;
  sortConfig?: SortConfig | unknown;
  sideMenuTitle?: string;
  className?: string;
  tableClassName?: string;
  emptyMessage?: string;
  filters?: TableFilterConfig[];
  filterValues?: TableFilterValues;
  onFilterValuesChange?: (values: TableFilterValues) => void;
}
