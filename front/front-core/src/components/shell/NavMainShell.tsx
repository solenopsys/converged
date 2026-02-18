import type { ReactNode, CSSProperties } from "react";
import { ChevronRight } from "lucide-react";

export interface MenuItemData {
  key?: string;
  title: string;
  icon?: ReactNode;
  href?: string;
  items?: MenuItemData[];
}

export interface NavMainShellProps {
  /** Menu items */
  items: MenuItemData[];
  /** Currently open sections (by key/title) */
  openSections?: Set<string> | string[];
  /** Callback when item clicked */
  onItemClick?: (item: MenuItemData) => void;
  /** Callback when section toggled */
  onSectionToggle?: (key: string, open: boolean) => void;
  /** Additional class */
  className?: string;
}

const getItemKey = (item: MenuItemData, index: number): string => {
  return item.key || item.title || `item-${index}`;
};

/**
 * NavMainShell - меню без effector
 *
 * Глупый компонент - принимает данные через props.
 * Для SSR: openSections из серверных данных, onItemClick = href navigation
 * Для SPA: openSections из effector store, onItemClick запускает action
 */
export function NavMainShell({
  items,
  openSections = [],
  onItemClick,
  onSectionToggle,
  className = "",
}: NavMainShellProps) {
  const openSet = openSections instanceof Set
    ? openSections
    : new Set(openSections);

  const menuStyle: CSSProperties = {
    listStyle: "none",
    padding: 0,
    margin: 0,
  };

  const itemStyle: CSSProperties = {
    padding: 0,
    margin: 0,
  };

  const buttonStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    width: "100%",
    padding: "8px 12px",
    border: "none",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    fontSize: "14px",
    textAlign: "left",
    gap: "8px",
    borderRadius: "6px",
    transition: "background-color 0.15s",
  };

  const chevronStyle = (isOpen: boolean): CSSProperties => ({
    width: "16px",
    height: "16px",
    transition: "transform 0.2s",
    transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
    flexShrink: 0,
    color: "oklch(var(--muted-foreground))",
  });

  const subMenuStyle: CSSProperties = {
    listStyle: "none",
    padding: "0 0 0 36px",
    margin: "4px 0",
  };

  const handleItemClick = (item: MenuItemData) => {
    if (item.href && !onItemClick) {
      // SSR fallback - navigate via href
      window.location.href = item.href;
    } else {
      onItemClick?.(item);
    }
  };

  const handleToggle = (key: string, currentOpen: boolean) => {
    onSectionToggle?.(key, !currentOpen);
  };

  return (
    <nav className={`nav-main-shell ${className}`}>
      <ul style={menuStyle}>
        {items.map((item, index) => {
          const key = getItemKey(item, index);
          const hasChildren = item.items && item.items.length > 0;
          const isOpen = openSet.has(key);

          return (
            <li key={key} style={itemStyle}>
              {item.href ? (
                <a
                  href={item.href}
                  onClick={(e) => {
                    if (onItemClick) {
                      e.preventDefault();
                      handleItemClick(item);
                    }
                  }}
                  style={{
                    ...buttonStyle,
                    textDecoration: "none",
                    color: "inherit",
                    width: "100%",
                    gap: "8px",
                  }}
                >
                  {hasChildren ? (
                    <span
                      onClick={() => handleToggle(key, isOpen)}
                      style={{ display: "inline-flex", width: "20px" }}
                      aria-hidden="true"
                    >
                      <ChevronRight style={chevronStyle(isOpen)} />
                    </span>
                  ) : (
                    <span style={{ width: "20px", flexShrink: 0 }} />
                  )}
                  {item.icon && <span style={{ flexShrink: 0 }}>{item.icon}</span>}
                  <span>{item.title}</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => handleItemClick(item)}
                  style={{ ...buttonStyle, width: "100%", gap: "8px" }}
                >
                  {hasChildren ? (
                    <span
                      onClick={() => handleToggle(key, isOpen)}
                      style={{ display: "inline-flex", width: "20px" }}
                      aria-hidden="true"
                    >
                      <ChevronRight style={chevronStyle(isOpen)} />
                    </span>
                  ) : (
                    <span style={{ width: "20px", flexShrink: 0 }} />
                  )}
                  {item.icon && <span style={{ flexShrink: 0 }}>{item.icon}</span>}
                  <span>{item.title}</span>
                </button>
              )}

              {/* Submenu */}
              {hasChildren && isOpen && (
                <ul style={subMenuStyle}>
                  {item.items!.map((subItem, subIndex) => {
                    const subKey = getItemKey(subItem, subIndex);
                    return (
                      <li key={subKey} style={itemStyle}>
                        {subItem.href ? (
                          <a
                            href={subItem.href}
                            onClick={(e) => {
                              if (onItemClick) {
                                e.preventDefault();
                                handleItemClick(subItem);
                              }
                            }}
                            style={{
                              ...buttonStyle,
                              textDecoration: "none",
                              color: "inherit",
                              padding: "6px 12px 6px 20px",
                              fontSize: "13px",
                            }}
                          >
                            {subItem.icon && <span style={{ flexShrink: 0 }}>{subItem.icon}</span>}
                            <span>{subItem.title}</span>
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleItemClick(subItem)}
                            style={{
                              ...buttonStyle,
                              padding: "6px 12px 6px 20px",
                              fontSize: "13px",
                            }}
                          >
                            {subItem.icon && <span style={{ flexShrink: 0 }}>{subItem.icon}</span>}
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
    </nav>
  );
}

export default NavMainShell;
