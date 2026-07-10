import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

export interface MenuItemData {
  key?: string;
  actionKey?: string;
  title: string;
  icon?: ReactNode;
  href?: string;
  items?: MenuItemData[];
}

export interface NavMainShellProps {
  items: MenuItemData[];
  openSections?: Set<string> | string[];
  currentPath?: string;
  onItemClick?: (item: MenuItemData) => void;
  onSectionToggle?: (key: string, open: boolean) => void;
  className?: string;
}

const getItemKey = (item: MenuItemData, index: number): string =>
  item.key || item.title || `item-${index}`;

const ROW_H = "h-7";

function TreeRow({
  icon,
  title,
  href,
  hasChildren,
  isOpen,
  isActive,
  depth,
  onToggle,
  onClick,
}: {
  icon?: ReactNode;
  title: string;
  href?: string;
  hasChildren: boolean;
  isOpen: boolean;
  isActive: boolean;
  depth: number;
  onToggle?: () => void;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="inline-flex w-4 shrink-0 items-center justify-center">
        {hasChildren && (
          <ChevronRight
            className={cn(
              "size-3 text-sidebar-foreground/45 transition-transform",
              isOpen && "rotate-90",
            )}
          />
        )}
      </span>
      <span className="inline-flex w-4 shrink-0 items-center justify-center [&>svg]:size-4">
        {icon}
      </span>
      <span className="truncate">{title}</span>
    </>
  );

  const className = cn(
    "nav-tree-row",
    "group flex w-full items-center gap-1 rounded-md text-sm text-sidebar-foreground/72 transition-colors hover:bg-sidebar-accent/45 hover:text-sidebar-accent-foreground",
    ROW_H,
    depth === 0 && "nav-tree-row-root font-medium text-sidebar-foreground/90",
    depth > 0 && "nav-tree-row-leaf font-normal",
    isActive && "nav-tree-row-active bg-sidebar-accent/70 text-sidebar-accent-foreground font-medium",
  );

  const handleClick = () => {
    if (hasChildren) {
      onToggle?.();
    }
    onClick?.();
  };

  if (href && !hasChildren) {
    return (
      <a
        href={href}
        className={className}
        style={{ paddingLeft: depth * 16 }}
        aria-current={isActive ? "page" : undefined}
        onClick={() => onClick?.()}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={cn(className, "cursor-pointer")}
      style={{ paddingLeft: depth * 16 }}
      onClick={handleClick}
    >
      {content}
    </button>
  );
}

export function NavMainShell({
  items,
  openSections = [],
  currentPath,
  onItemClick,
  onSectionToggle,
  className,
}: NavMainShellProps) {
  const openSet = openSections instanceof Set ? openSections : new Set(openSections);

  const isCurrent = (href?: string) => {
    if (!href || !currentPath) return false;
    const normalize = (value: string) => value.replace(/#.*$/, "").replace(/\/?$/, "/");
    return normalize(href) === normalize(currentPath);
  };

  function renderItems(nodes: MenuItemData[], depth: number) {
    return nodes.map((item, index) => {
      const key = getItemKey(item, index);
      const hasChildren = Boolean(item.items?.length);
      const isOpen = openSet.has(key);
      const isActive = isCurrent(item.href);

      return (
        <li key={key}>
          <TreeRow
            icon={item.icon}
            title={item.title}
            href={item.href}
            hasChildren={hasChildren}
            isOpen={isOpen}
            isActive={isActive}
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
