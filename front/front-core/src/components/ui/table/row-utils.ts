import type { RowId, TableRowBase } from "./InfiniteScrollDataTable.types";

export function getRowValue<TData extends object>(
  row: TData,
  columnId: string,
): unknown {
  return (row as Record<string, unknown>)[columnId];
}

export function getRowId<TData extends object>(
  row: TData,
  index: number,
): RowId {
  const candidate = (row as TableRowBase).id;
  return candidate ?? index;
}

export function hasRowId<TData extends object>(
  rowIds: RowId[],
  row: TData,
  index: number,
): boolean {
  return rowIds.includes(getRowId(row, index));
}
