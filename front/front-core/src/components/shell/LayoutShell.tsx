import type { ReactNode, CSSProperties } from "react";

export interface LayoutShellProps {
  /** Content for center area */
  center?: ReactNode;
  /** Content for sidebar panel (menu/chat/etc) */
  panel?: ReactNode;
  /** Content for sidebar header */
  header?: ReactNode;
  /** Content for tabs strip */
  tabs?: ReactNode;
  /** Content for input area */
  input?: ReactNode;
  /** Sidebar width */
  sidebarWidth?: number;
  /** Additional class for root element */
  className?: string;
  /** CSS variables */
  style?: CSSProperties;
}

const defaultStyle: CSSProperties = {
  "--sidebar-width": "380px",
  "--tabs-width": "48px",
  "--input-height": "96px",
  "--header-height": "96px",
} as CSSProperties;

/**
 * LayoutShell - статический скелет приложения
 *
 * Рендерит фиксированную структуру с слотами:
 * - slot-center: основной контент
 * - slot-panel: контент боковой панели
 * - slot-tabs: иконки табов
 * - slot-input: поле ввода
 *
 * Глупый компонент - не знает про effector, просто рендерит children в слоты.
 * SSR рендерит дефолтный контент, SPA гидратирует или заменяет.
 */
export function LayoutShell({
  center,
  panel,
  header,
  tabs,
  input,
  sidebarWidth = 380,
  className = "",
  style,
}: LayoutShellProps) {
  const mergedStyle: CSSProperties = {
    ...defaultStyle,
    "--sidebar-width": `${sidebarWidth}px`,
    ...style,
  };

  return (
    <div
      className={`layout-shell ${className}`}
      style={{
        ...mergedStyle,
        display: "flex",
        height: "100svh",
        minHeight: 0,
        backgroundColor: "oklch(var(--background))",
        color: "oklch(var(--foreground))",
      }}
    >
      {/* Center - основной контент */}
      <main
        id="slot-center"
        data-sidebar-slot="sidebar:center"
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "auto",
        }}
      >
        {center}
      </main>

      {/* Sidebar */}
      <aside
        className="layout-sidebar"
        data-sidebar="right"
        style={{
          width: "var(--sidebar-width)",
          display: "flex",
          flexDirection: "row",
          borderLeft: "1px solid oklch(var(--border))",
          backgroundColor: "oklch(var(--sidebar))",
          position: "relative",
        }}
      >
        {/* Resizer for sidebar-controller */}
        <div
          data-sidebar-resizer="right"
          style={{
            position: "absolute",
            left: "-6px",
            top: 0,
            bottom: 0,
            width: "12px",
            cursor: "col-resize",
            zIndex: 2,
          }}
        />

        {/* Panel content */}
        <div
          data-sidebar-content="right"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          {/* Header */}
          <div
            style={{
              height: "var(--header-height)",
              borderBottom: "1px solid oklch(var(--border))",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              padding: "0 16px",
              gap: "12px",
              position: "relative",
            }}
          >
            <button
              type="button"
              data-sidebar-trigger="right"
              aria-label="Toggle sidebar"
              style={{
                width: "32px",
                height: "32px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                flexShrink: 0,
              }}
            />
            {header}
          </div>

          {/* Panel slot */}
          <div
            style={{
              flex: 1,
              overflow: "auto",
              minHeight: 0,
              position: "relative",
            }}
          >
            <div
              id="slot-panel-menu"
              data-sidebar-slot="sidebar:left"
              style={{
                position: "absolute",
                inset: 0,
                overflow: "auto",
              }}
            >
              {panel}
            </div>
            <div
              id="slot-panel-tab"
              data-sidebar-slot="sidebar:tab"
              style={{
                position: "absolute",
                inset: 0,
                overflow: "auto",
                display: "none",
              }}
            />
            <div
              id="slot-panel-chat"
              data-sidebar-slot="sidebar:right"
              style={{
                position: "absolute",
                inset: 0,
                overflow: "auto",
                display: "none",
              }}
            />
          </div>


          {/* Input slot */}
          <div
            id="slot-input"
            data-sidebar-slot="sidebar:input"
            style={{
              height: "var(--input-height)",
              borderTop: "1px solid oklch(var(--border))",
              flexShrink: 0,
              padding: 0,
              backgroundColor: "oklch(var(--muted) / 0.3)",
              display: "flex",
              alignItems: "stretch",
            }}
          >
            {input}
          </div>
        </div>

        {/* Tabs strip */}
        <div
          id="slot-tabs"
          data-sidebar-tabs="left"
          data-sidebar-slot="sidebar:tabs"
          style={{
            width: "var(--tabs-width)",
            borderLeft: "1px solid oklch(var(--border))",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: "8px",
            flexShrink: 0,
          }}
        >
          {tabs}
        </div>
      </aside>
    </div>
  );
}

export default LayoutShell;
