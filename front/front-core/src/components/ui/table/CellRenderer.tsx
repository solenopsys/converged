"use client";

import React from "react";
import { Check, MoreHorizontal, X } from "lucide-react";
import { cn } from "../../../lib/utils";
import { Badge } from "../badge";
import { COLUMN_TYPES } from "./constants";
import type {
  ColumnConfig,
  RowActionHandler,
} from "./InfiniteScrollDataTable.types";
import { TableActionsMenu } from "./TableActionsMenu";

type CellRendererProps<TData extends object> = {
  value: unknown;
  column: ColumnConfig<TData>;
  rowData: TData;
  onAction?: RowActionHandler<TData>;
};

function renderFallback(value: unknown) {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function parseDateValue(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  return new Date(String(value));
}

export function CellRenderer<TData extends object>({
  value,
  column,
  rowData,
  onAction,
}: CellRendererProps<TData>) {
  const { type, render, statusConfig = {}, actions = [] } = column;

  if (typeof render === "function") {
    return render(value, rowData, onAction);
  }

  switch (type) {
    case COLUMN_TYPES.TEXT: {
      const text = value == null ? "" : String(value);
      return (
        <div className="truncate text-sm" title={text}>
          {text}
        </div>
      );
    }

    case COLUMN_TYPES.NUMBER:
      return (
        <div className="text-sm font-mono tabular-nums">
          {typeof value === "number" ? value.toLocaleString() : renderFallback(value)}
        </div>
      );

    case COLUMN_TYPES.DATE:
      return (
        <div className="text-sm text-muted-foreground">
          {value ? parseDateValue(value).toLocaleString("ru-RU") : "-"}
        </div>
      );

    case COLUMN_TYPES.BOOLEAN:
      return (
        <div className="flex justify-center">
          <div
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full",
              value ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {value ? <Check size={12} /> : <X size={12} />}
          </div>
        </div>
      );

    case COLUMN_TYPES.STATUS: {
      const config = statusConfig[String(value)] ?? {
        label: renderFallback(value),
        variant: "secondary",
      };

      return (
        <Badge
          variant={config.variant as React.ComponentProps<typeof Badge>["variant"]}
          className={config.className}
        >
          {config.label}
        </Badge>
      );
    }

    case COLUMN_TYPES.TAGS: {
      if (!Array.isArray(value) || value.length === 0) {
        return <span className="text-sm text-muted-foreground">-</span>;
      }

      const maxVisible = 2;
      const visibleTags = value.slice(0, maxVisible);
      const hiddenCount = value.length - maxVisible;

      return (
        <div className="flex items-center gap-1" title={value.join(", ")}>
          {visibleTags.map((tag, index) => (
            <span
              key={`${String(tag)}-${index}`}
              className="inline-flex items-center whitespace-nowrap rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground"
            >
              {String(tag)}
            </span>
          ))}
          {hiddenCount > 0 && (
            <span className="inline-flex cursor-help items-center whitespace-nowrap rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              +{hiddenCount}
            </span>
          )}
        </div>
      );
    }

    case COLUMN_TYPES.ACTIONS:
      if (actions.length === 0) return null;

      return (
        <TableActionsMenu
          trigger={
            <button
              type="button"
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-md p-0 text-sm font-medium",
                "hover:bg-accent hover:text-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Открыть меню</span>
            </button>
          }
          items={actions.map((action) => ({
            ...action,
            onClick: () => {
              action.onClick?.(rowData);
              onAction?.(action.id, rowData);
            },
          }))}
        />
      );

    default:
      return <div className="text-sm">{renderFallback(value)}</div>;
  }
}
