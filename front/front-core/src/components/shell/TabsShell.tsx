import type { ReactNode, CSSProperties } from "react";

export interface TabItemData {
  id: string;
  icon: ReactNode;
  label?: string;
}

export interface TabsShellProps {
  /** Tab items */
  tabs: TabItemData[];
  /** Active tab id */
  activeTab?: string;
  /** Callback when tab clicked */
  onTabClick?: (tabId: string) => void;
  /** Additional class */
  className?: string;
}

/**
 * TabsShell - панель иконок табов без effector
 *
 * Глупый компонент - принимает данные через props.
 * Для SSR: статические табы, onTabClick = noop
 * Для SPA: tabs из effector store, onTabClick запускает action
 */
export function TabsShell({
  tabs,
  activeTab,
  onTabClick,
  className = "",
}: TabsShellProps) {
  const buttonStyle = (isActive: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    border: "none",
    background: "transparent",
    color: isActive ? "oklch(var(--sidebar-primary))" : "oklch(var(--sidebar-foreground) / 0.6)",
    cursor: "pointer",
    borderRadius: "6px",
    transition: "color 0.15s, background-color 0.15s",
    padding: 0,
    margin: "2px 0",
  });

  const iconStyle: CSSProperties = {
    width: "20px",
    height: "20px",
  };

  return (
    <div
      className={`tabs-shell ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "2px",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabClick?.(tab.id)}
            style={buttonStyle(isActive)}
            aria-label={tab.label || tab.id}
            aria-pressed={isActive}
            title={tab.label || tab.id}
          >
            <span style={iconStyle}>{tab.icon}</span>
          </button>
        );
      })}
    </div>
  );
}

export default TabsShell;
