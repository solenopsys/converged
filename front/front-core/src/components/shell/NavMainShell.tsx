import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

export interface MenuItemData {
  key?: string;
  title: string;
  icon?: ReactNode;
  href?: string;
  items?: MenuItemData[];
}

export interface NavMainShellProps {
  items: MenuItemData[];
  openSections?: Set<string> | string[];
  onItemClick?: (item: MenuItemData) => void;
  onSectionToggle?: (key: string, open: boolean) => void;
  className?: string;
}

const getItemKey = (item: MenuItemData, index: number): string =>
  item.key || item.title || `item-${index}`;

const ROW_H = "h-7";
const INDENT = "pl-4";

function TreeRow({
  icon,
  title,
  hasChildren,
  isOpen,
  depth,
  onToggle,
  onClick,
}: {
  icon?: ReactNode;
  title: string;
  hasChildren: boolean;
  isOpen: boolean;
  depth: number;
  onToggle?: () => void;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn("flex w-full items-center gap-1 rounded-md text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer", ROW_H)}
      style={{ paddingLeft: depth * 16 }}
      onClick={hasChildren ? onToggle : onClick}
    >
      {/* chevron — фиксированная ширина, всегда занимает место */}
      <span className="inline-flex w-4 shrink-0 items-center justify-center">
        {hasChildren && (
          <ChevronRight
            className={cn("size-3 text-sidebar-foreground/50 transition-transform", isOpen && "rotate-90")}
          />
        )}
      </span>
      {/* иконка — фиксированная ширина, всегда занимает место */}
      <span className="inline-flex w-4 shrink-0 items-center justify-center [&>svg]:size-4">
        {icon}
      </span>
      <span className="truncate">{title}</span>
    </div>
  );
}

export function NavMainShell({
  items,
  openSections = [],
  onItemClick,
  onSectionToggle,
  className,
}: NavMainShellProps) {
  const openSet = openSections instanceof Set ? openSections : new Set(openSections);

  function renderItems(nodes: MenuItemData[], depth: number) {
    return nodes.map((item, index) => {
      const key = getItemKey(item, index);
      const hasChildren = Boolean(item.items?.length);
      const isOpen = openSet.has(key);

      return (
        <li key={key}>
          <TreeRow
            icon={item.icon}
            title={item.title}
            hasChildren={hasChildren}
            isOpen={isOpen}
            depth={depth}
            onToggle={() => onSectionToggle?.(key, !isOpen)}
            onClick={() => onItemClick?.(item)}
          />
          {hasChildren && isOpen && (
            <ul>{renderItems(item.items!, depth + 1)}</ul>
          )}
        </li>
      );
    });
  }

  return (
    <div className={cn("w-full min-w-0", className)}>
      <ul className="flex flex-col gap-0.5">
        {renderItems(items, 0)}
      </ul>
    </div>
  );
}

export default NavMainShell;
