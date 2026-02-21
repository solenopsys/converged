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

export function NavMainShell({
  items,
  openSections = [],
  onItemClick,
  onSectionToggle,
  className,
}: NavMainShellProps) {
  const openSet = openSections instanceof Set ? openSections : new Set(openSections);

  return (
    <div className={cn("relative flex w-full min-w-0 flex-col p-2", className)}>
      <ul className="flex w-full min-w-0 flex-col gap-1">
        {items.map((item, index) => {
          const key = getItemKey(item, index);
          const hasChildren = Boolean(item.items?.length);
          const isOpen = openSet.has(key);

          return (
            <li key={key} className="group/menu-item relative">
              <div className="flex w-full items-center gap-1">
                {hasChildren ? (
                  <button
                    type="button"
                    aria-label="Toggle"
                    onClick={() => onSectionToggle?.(key, !isOpen)}
                    className="text-sidebar-foreground/70 hover:text-sidebar-foreground inline-flex h-8 w-6 items-center justify-center rounded-md transition-colors shrink-0"
                  >
                    <ChevronRight className={cn("size-4 transition-transform", isOpen && "rotate-90")} />
                  </button>
                ) : (
                  <span className="inline-flex h-8 w-6 shrink-0" />
                )}
                <button
                  type="button"
                  onClick={() => onItemClick?.(item)}
                  className="peer/menu-button flex flex-1 min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 h-8"
                >
                  {item.icon}
                  <span>{item.title}</span>
                </button>
              </div>

              {hasChildren && isOpen && (
                <ul className="border-sidebar-border flex min-w-0 flex-col gap-1 border-l py-0.5 ml-[11px] pl-4">
                  {item.items!.map((subItem, subIndex) => {
                    const subKey = getItemKey(subItem, subIndex);
                    const hasSubChildren = Boolean(subItem.items?.length);
                    const subOpen = openSet.has(subKey);

                    return (
                      <li key={subKey} className="group/menu-sub-item relative">
                        {hasSubChildren ? (
                          <>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onSectionToggle?.(subKey, !subOpen)}
                                className="text-sidebar-foreground/70 hover:text-sidebar-foreground inline-flex h-7 w-5 items-center justify-center rounded-md transition-colors shrink-0"
                              >
                                <ChevronRight className={cn("size-3 transition-transform", subOpen && "rotate-90")} />
                              </button>
                              <button
                                type="button"
                                onClick={() => onItemClick?.(subItem)}
                                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex flex-1 h-7 min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 text-sm outline-hidden focus-visible:ring-2 [&>span:last-child]:truncate cursor-pointer"
                              >
                                <span>{subItem.title}</span>
                              </button>
                            </div>
                            {subOpen && (
                              <ul className="border-sidebar-border flex min-w-0 flex-col gap-1 border-l py-0.5 ml-[9px] pl-4 mt-0.5">
                                {subItem.items!.map((subSubItem) => (
                                  <li key={subSubItem.title}>
                                    <button
                                      type="button"
                                      onClick={() => onItemClick?.(subSubItem)}
                                      className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex h-7 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 text-sm outline-hidden focus-visible:ring-2 [&>span:last-child]:truncate cursor-pointer"
                                    >
                                      <span>{subSubItem.title}</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onItemClick?.(subItem)}
                            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex h-7 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 text-sm outline-hidden focus-visible:ring-2 [&>span:last-child]:truncate cursor-pointer"
                          >
                            <span>{subItem.title}</span>
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default NavMainShell;
