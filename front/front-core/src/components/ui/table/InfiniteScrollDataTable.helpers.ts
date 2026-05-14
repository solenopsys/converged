import type {
  BulkAction,
  ColumnConfig,
  ViewMode,
} from "./InfiniteScrollDataTable.types";

function parseColumnWidth(value: string | number | undefined): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.endsWith("px")) {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

export function normalizeRows<TData extends object>(value: unknown): TData[] {
  return Array.isArray(value) ? (value as TData[]) : [];
}

export function normalizeColumns<TData extends object>(
  value: unknown,
): Array<ColumnConfig<TData>> {
  return Array.isArray(value) ? (value as Array<ColumnConfig<TData>>) : [];
}

export function normalizeViewMode(value: unknown): ViewMode {
  return value === "cards" ? "cards" : "table";
}

export function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeBulkActions(value: unknown): BulkAction[] {
  return Array.isArray(value) ? (value as BulkAction[]) : [];
}

export function resolveFallbackColumnWidths<TData extends object>(
  columns: Array<ColumnConfig<TData>>,
) {
  return columns.map((column) => {
    const explicitWidth = parseColumnWidth(column.width);
    const width = explicitWidth ?? column.minWidth ?? (column.primary ? 300 : 150);
    const minWidth = column.minWidth ?? 50;
    const maxWidth = column.maxWidth ?? Number.POSITIVE_INFINITY;
    return Math.min(Math.max(width, minWidth), maxWidth);
  });
}

export function resolveInitialColumnWidths<TData extends object>(
  columns: Array<ColumnConfig<TData>>,
  availableWidth: number,
) {
  const minWidths = columns.map((column) => column.minWidth ?? 50);
  const maxWidths = columns.map(
    (column) => column.maxWidth ?? Number.POSITIVE_INFINITY,
  );
  const explicitWidths = columns.map((column) => parseColumnWidth(column.width));

  let widths = columns.map((column, index) => {
    const base =
      explicitWidths[index] ?? column.minWidth ?? (column.primary ? 300 : 150);
    return Math.min(Math.max(base, minWidths[index]), maxWidths[index]);
  });

  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  const hasExplicitWidths = explicitWidths.some((width) => width != null);
  if (!hasExplicitWidths && availableWidth > 0 && totalWidth < availableWidth) {
    let remaining = availableWidth - totalWidth;
    const extraPerColumn = remaining / widths.length;

    widths = widths.map((width, index) => {
      const isLast = index === widths.length - 1;
      const extra = isLast ? remaining : extraPerColumn;
      const nextWidth = Math.min(maxWidths[index], width + extra);
      remaining -= nextWidth - width;
      return nextWidth;
    });
  }

  return widths.map((width) => Math.round(width));
}
