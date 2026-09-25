import { translator } from "i18n";
import type { ComponentChildren } from "preact";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";
import { COLUMN_TYPES } from "./constants";
import { CellRenderer } from "./CellRenderer";
import type { ColumnConfig, RowActionHandler, RowCardProps } from "./types";
import { getRowValue } from "./row-utils";

const t = translator(CHAT_MESSAGES_NAMESPACE);

const DEFAULT_CARD_SECONDARY_LIMIT = 6;

function parseDateValue(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  return new Date(String(value));
}

function formatTitleValue(value: unknown, type: string) {
  if (value == null || value === "") return "-";
  if (type === COLUMN_TYPES.NUMBER && typeof value === "number") {
    return value.toLocaleString();
  }
  if (type === COLUMN_TYPES.DATE) {
    const date = parseDateValue(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  if (type === COLUMN_TYPES.BOOLEAN)
    return value ? t("table.yes") : t("table.no");
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isEmptyCardValue(value: unknown) {
  if (value == null || value === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function resolveDefaultCardColumns<TData extends object>(
  columns: Array<ColumnConfig<TData>>,
) {
  const visibleColumns = columns
    .filter(
      (column) =>
        column.cardVisible !== false && column.type !== COLUMN_TYPES.ACTIONS,
    )
    .map((column, index) => ({ column, index }));

  if (visibleColumns.length === 0) {
    return {
      primaryColumn: null as ColumnConfig<TData> | null,
      secondaryColumns: [] as Array<ColumnConfig<TData>>,
    };
  }

  const orderedColumns = visibleColumns
    .sort((left, right) => {
      const leftOrder =
        typeof left.column.cardOrder === "number"
          ? left.column.cardOrder
          : Number.POSITIVE_INFINITY;
      const rightOrder =
        typeof right.column.cardOrder === "number"
          ? right.column.cardOrder
          : Number.POSITIVE_INFINITY;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.index - right.index;
    })
    .map(({ column }) => column);

  const primaryColumn =
    orderedColumns.find((column) => column.cardPrimary) ??
    orderedColumns.find((column) => column.primary) ??
    orderedColumns[0];

  const secondaryColumns = orderedColumns
    .filter((column) => column.id !== primaryColumn.id)
    .slice(0, DEFAULT_CARD_SECONDARY_LIMIT);

  return { primaryColumn, secondaryColumns };
}

export function DefaultRowCard<TData extends object>({
  data,
  columns,
  onAction,
  onRowNavigate,
  rowHref,
}: RowCardProps<TData>) {
  const { primaryColumn, secondaryColumns } =
    resolveDefaultCardColumns(columns);
  const titleValue = primaryColumn
    ? getRowValue(data, primaryColumn.id)
    : undefined;
  const idLink = (children: ComponentChildren) => (
    <a
      href={rowHref?.(data) ?? "#"}
      class="text-primary underline-offset-2 hover:underline"
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        onRowNavigate?.(data);
      }}
    >
      {children}
    </a>
  );

  return (
    <div class="rounded-lg border bg-card p-3 transition-colors hover:bg-accent/40">
      {primaryColumn && (
        <div class="mb-2">
          <h3 class="break-words text-sm font-semibold leading-snug">
            {primaryColumn.id === "id" && onRowNavigate
              ? idLink(formatTitleValue(titleValue, primaryColumn.type))
              : formatTitleValue(titleValue, primaryColumn.type)}
          </h3>
        </div>
      )}

      <div class="space-y-1">
        {secondaryColumns.map((column) => {
          const value = getRowValue(data, column.id);
          if (isEmptyCardValue(value)) return null;

          return (
            <div
              key={column.id}
              class="grid grid-cols-[minmax(96px,max-content)_1fr] items-start gap-2 text-xs"
            >
              <span class="truncate text-muted-foreground">{column.title}</span>
              <div class="min-w-0">
                {column.id === "id" && onRowNavigate ? (
                  idLink(
                    <CellRenderer
                      value={value}
                      column={column}
                      rowData={data}
                      onAction={onAction as RowActionHandler<TData>}
                    />,
                  )
                ) : (
                  <CellRenderer
                    value={value}
                    column={column}
                    rowData={data}
                    onAction={onAction as RowActionHandler<TData>}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
