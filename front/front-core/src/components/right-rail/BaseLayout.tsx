"use client";
import "./BaseLayout.css";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { useUnit } from "effector-react";
import { $rightSidebarWidth, restoreState, sidebarWidthChanged } from "sidebar-controller";
import {
  $activePanel,
  $collapsed,
  $constrained,
  $device,
  $layoutMode,
  $panelResizing,
  $panelConfig,
  $parallel,
  type ActivePanel,
  setActivePanel,
  setCollapsed,
  setConstrained,
  setDevice,
  setPanelResizing,
  toggleParallel,
} from "./panelController";
import { LandingTopBar } from "../landing-topbar/LandingTopBar";
import { startRightRailUriSync } from "./uri-sync";
import { ChatPanel } from "./RightRailPanels";
import { $centerView } from "../../slots/present";
import { SlotProvider } from "../../slots/SlotProvider";
import { chatAttachRequested, chatSendRequested } from "../../chat/events";
import { Paperclip, Send } from "lucide-react";

const MIN_PANEL_WIDTH = 280;
const MAX_PANEL_WIDTH = 680;
const DEFAULT_PANEL_WIDTH = 390;
const RAIL_PADDING_PX = 4;
const PARALLEL_OVERLAP_PX = 8;
const COLLAPSED_WIDTH_PX = 42;

function CenterContent({ fallback }: { fallback?: ReactNode }) {
  const centerView = useUnit($centerView);

  if (centerView) {
    const View = centerView.view;
    return <View {...centerView.config} />;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return <Outlet />;
}

export interface BaseLayoutProps {
  centerFallback?: ReactNode;
  topBar?: ReactNode;
}

export function BaseLayout({ centerFallback, topBar }: BaseLayoutProps = {}) {
  const layoutMode = useUnit($layoutMode);

  if (layoutMode === "landing") {
    return <LandingLayout centerFallback={centerFallback} topBar={topBar} />;
  }

  return <AppLayout centerFallback={centerFallback} />;
}

function LandingLayout({ centerFallback, topBar }: { centerFallback?: ReactNode; topBar?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--ui-background)" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 1000, flexShrink: 0 }}>
        {topBar ?? <LandingTopBar compact />}
      </div>
      <main style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <CenterContent fallback={centerFallback} />
      </main>
    </div>
  );
}

function AppLayout({ centerFallback }: { centerFallback?: ReactNode }) {
  const [footerValue, setFooterValue] = useState("");
  const [footerFocused, setFooterFocused] = useState(false);
  const {
    device,
    activePanel,
    collapsed,
    parallel,
    constrained,
    panelResizing,
    panelConfig,
    rightSidebarWidth,
    onDevice,
    onFront,
    onCollapsed,
    onConstrain,
    onPanelResizing,
    onParallel,
  } = useUnit({
    device: $device,
    activePanel: $activePanel,
    collapsed: $collapsed,
    constrained: $constrained,
    parallel: $parallel,
    panelResizing: $panelResizing,
    panelConfig: $panelConfig,
    rightSidebarWidth: $rightSidebarWidth,
    onDevice: setDevice,
    onFront: setActivePanel,
    onCollapsed: setCollapsed,
    onConstrain: setConstrained,
    onPanelResizing: setPanelResizing,
    onParallel: toggleParallel,
  });

  const updatePanelWidth = useCallback((nextWidth: number) => {
    const width = Math.round(Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, nextWidth)));
    sidebarWidthChanged({ side: "right", width });
  }, []);

  const normalizedPanelWidth =
    Number.isFinite(rightSidebarWidth) && rightSidebarWidth > 0
      ? Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, rightSidebarWidth))
      : DEFAULT_PANEL_WIDTH;

  const desktopStackWidth = useMemo(() => {
    if (collapsed) return COLLAPSED_WIDTH_PX;
    return normalizedPanelWidth;
  }, [collapsed, normalizedPanelWidth]);

  const superPanelExpanded = !collapsed && (activePanel === "chat" || footerFocused);

  const layoutStyle = useMemo(() => {
    const vars: CSSProperties = {
      "--panel-width": `${normalizedPanelWidth}px`,
      "--super-menu-width": "0px",
      "--super-panel-width": `${normalizedPanelWidth}px`,
    } as CSSProperties;

    if (device === "desktop") {
      const railWidth = desktopStackWidth + RAIL_PADDING_PX * 2;
      (vars as Record<string, string>)["--stack-width"] = `${desktopStackWidth}px`;
      (vars as Record<string, string>)["--rail-width"] = `${railWidth}px`;
    }

    return vars;
  }, [device, normalizedPanelWidth, desktopStackWidth]);

  const handleResizePointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (device !== "desktop" || collapsed) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startWidth = normalizedPanelWidth;
      const previousUserSelect = document.body.style.userSelect;
      const previousCursor = document.body.style.cursor;

      document.body.style.userSelect = "none";
      document.body.style.cursor = "ew-resize";
      onPanelResizing(true);

      const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
        moveEvent.preventDefault();
        // The rail is mounted before the center area, so dragging its outer edge
        // to the right grows the panel.
        const delta = moveEvent.clientX - startX;
        updatePanelWidth(startWidth + delta);
      };

      const cleanup = () => {
        onPanelResizing(false);
        document.body.style.userSelect = previousUserSelect;
        document.body.style.cursor = previousCursor;
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerCancel);
      };

      const onPointerUp = () => cleanup();
      const onPointerCancel = () => cleanup();

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerCancel);
    },
    [collapsed, device, normalizedPanelWidth, onPanelResizing, updatePanelWidth],
  );

  useEffect(() => {
    restoreState();
    startRightRailUriSync();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(max-width: 980px)");
    const apply = () => onDevice(media.matches ? "mobile" : "desktop");
    apply();
    if (media.addEventListener) {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
    media.addListener(apply);
    return () => media.removeListener(apply);
  }, [onDevice]);

  const handleToggleCollapse = () => {
    if (constrained) {
      return;
    }
    const next = !collapsed;
    onCollapsed(next);
    if (next) {
      onFront("chat");
    }
  };

  const handleToggleConstrain = () => {
    onConstrain(!constrained);
  };

  const handlePanelClick = (panel: ActivePanel) => {
    if (collapsed) {
      onCollapsed(false);
    }
    onFront(panel);
  };

  const handleFooterFocus = () => {
    if (collapsed) {
      onCollapsed(false);
    }
    setFooterFocused(true);
    onFront("chat");
  };

  const handleFooterBlur = () => {
    window.setTimeout(() => setFooterFocused(false), 0);
  };

  const handleFooterSubmit = () => {
    const text = footerValue.trim();
    if (!text) return;
    chatSendRequested(text);
    setFooterValue("");
    onFront("chat");
  };

  const handleFooterAttach = () => {
    chatAttachRequested();
    onFront("chat");
  };

  return (
    <div
      className="app-layout"
      data-device={device}
      data-front={activePanel}
      data-mode={parallel ? "parallel" : "stacked"}
      data-collapsed={collapsed ? "true" : "false"}
      data-constrained={constrained ? "true" : "false"}
      data-resizing={panelResizing ? "true" : "false"}
      data-super-expanded={superPanelExpanded ? "true" : "false"}
      style={
        layoutStyle
      }
    >
      <SlotProvider>
        <div className="app-shell">
          <div className="app-stage">
            <aside className="app-rail">
              <div className="panel-stack">
                <ChatPanel
                  {...panelConfig.chat}
                  showComposer={false}
                  collapsed={collapsed}
                  onToggleCollapse={constrained ? undefined : handleToggleCollapse}
                  onClick={() => handlePanelClick("chat")}
                />
                {device === "desktop" && !collapsed ? (
                  <button
                    type="button"
                    className="rail-resizer"
                    aria-label="Resize chat panel"
                    onPointerDown={handleResizePointerDown}
                  />
                ) : null}
                <div className="super-chat-footer">
                  <form
                    className="super-chat-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleFooterSubmit();
                    }}
                  >
                    <textarea
                      className="super-chat-input"
                      value={footerValue}
                      rows={superPanelExpanded ? 3 : 1}
                      placeholder="Напишите сообщение..."
                      onChange={(event) => setFooterValue(event.target.value)}
                      onFocus={handleFooterFocus}
                      onBlur={handleFooterBlur}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          handleFooterSubmit();
                        }
                      }}
                    />
                    <div className="super-chat-actions">
                      <button
                        type="button"
                        className="panel-icon-button panel-action-button super-chat-attach"
                        aria-label="Attach file"
                        onClick={handleFooterAttach}
                      >
                        <Paperclip className="panel-icon" />
                      </button>
                      <button
                        type="submit"
                        className="panel-icon-button panel-action-button super-chat-send"
                        aria-label="Send"
                      >
                        <Send className="panel-icon" />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </aside>
            <main className="app-content">
              <div className="app-center">
                <CenterContent fallback={centerFallback} />
              </div>
            </main>
          </div>
        </div>
      </SlotProvider>
    </div>
  );
}
