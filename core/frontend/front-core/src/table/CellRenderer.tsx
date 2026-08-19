import { Check, MoreHorizontal, X } from "../icons";
import { Badge, cn } from "front-core";
import type { ComponentProps } from "preact";
import { COLUMN_TYPES } from "./constants";
import type {
  ColumnConfig,
  RowActionHandler,
} from "./types";
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
        <div class="truncate text-sm" title={text}>
          {text}
        </div>
      );
    }

    case COLUMN_TYPES.NUMBER:
      return (
        <div class="text-sm font-mono tabular-nums">
          {typeof value === "number" ? value.toLocaleString() : renderFallback(value)}
        </div>
      );

    case COLUMN_TYPES.DATE:
      return (
        <div class="text-sm text-muted-foreground">
          {value ? parseDateValue(value).toLocaleString("ru-RU") : "-"}
        </div>
      );

    case COLUMN_TYPES.BOOLEAN:
      return (
        <div class="flex justify-center">
          <div
            class={cn(
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
          variant={config.variant as ComponentProps<typeof Badge>["variant"]}
          class={config.className}
        >
          {config.label}
        </Badge>
      );
    }

    case COLUMN_TYPES.TAGS: {
      if (!Array.isArray(value) || value.length === 0) {
        return <span class="text-sm text-muted-foreground">-</span>;
      }

      const maxVisible = 2;
      const visibleTags = value.slice(0, maxVisible);
      const hiddenCount = value.length - maxVisible;

      return (
        <div class="flex items-center gap-1" title={value.join(", ")}>
          {visibleTags.map((tag, index) => (
            <span
              key={`${String(tag)}-${index}`}
              class="inline-flex items-center whitespace-nowrap rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground"
            >
              {String(tag)}
            </span>
          ))}
          {hiddenCount > 0 && (
            <span class="inline-flex cursor-help items-center whitespace-nowrap rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
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
              class={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-md p-0 text-sm font-medium",
                "hover:bg-accent hover:text-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <MoreHorizontal class="h-4 w-4" />
              <span class="sr-only">Открыть меню</span>
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
      return <div class="text-sm">{renderFallback(value)}</div>;
  }
}
