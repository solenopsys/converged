import { cn } from "@/lib/utils";

type SimpleListItem = {
  id: string;
  title: string;
};

type SimpleListProps = {
  title: string;
  items?: SimpleListItem[];
  onSelect: (id: string) => void;
  selectedId?: string;
  loading?: boolean;
  emptyLabel?: string;
};

export default function SimpleList({
  title,
  items = [],
  onSelect,
  selectedId,
  loading,
  emptyLabel = "Нет данных",
}: SimpleListProps) {
  const state = loading ? "loading" : items.length === 0 ? "empty" : "ready";

  return (
    <div
      data-slot="simple-list"
      data-state={state}
      className="rounded-lg border shadow-md overflow-hidden"
    >
      <div className="border-b px-4 py-2 text-sm font-medium">{title}</div>
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Загрузка...</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">{emptyLabel}</div>
        ) : (
          <div className="flex flex-col divide-y">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                data-item-id={item.id}
                data-selected={selectedId === item.id ? "true" : undefined}
                className={cn(
                  "text-left px-4 py-2 text-sm transition-colors",
                  selectedId === item.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/40",
                )}
                onClick={() => onSelect(item.id)}
              >
                {item.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
